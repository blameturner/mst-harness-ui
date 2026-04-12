import { gatewayUrl } from '../lib/runtime-env';
import type { StreamEvent } from './types/StreamEvent';

/**
 * Reconnects to an existing job's SSE stream by replaying from cursor 0.
 * Returns null if the job is gone (404 / no events within timeout).
 */
export async function* replayStream(
  jobId: string,
  signal?: AbortSignal,
): AsyncGenerator<StreamEvent, void, void> {
  type QueueItem = StreamEvent | { __done: true } | { __reconnect: true } | { __abort: true };
  const queue: QueueItem[] = [];
  let waiting: ((v: void) => void) | null = null;
  function push(item: QueueItem) {
    queue.push(item);
    if (waiting) { waiting(); waiting = null; }
  }
  async function pull() {
    while (queue.length === 0) {
      await new Promise<void>((r) => { waiting = r; });
    }
    return queue.shift()!;
  }

  signal?.addEventListener('abort', () => push({ __abort: true }));

  let cursor = 0;
  let emptyRetries = 0;
  let activeEs: EventSource | null = null;
  const MAX_EMPTY_RETRIES = 4;
  let receivedAny = false;

  function connect() {
    const streamUrl = `${gatewayUrl()}/api/stream/${encodeURIComponent(jobId)}?cursor=${cursor}`;
    const es = new EventSource(streamUrl, { withCredentials: true });

    es.onopen = () => { emptyRetries = 0; };

    es.onmessage = (e) => {
      receivedAny = true;
      if (e.data === '[DONE]') {
        es.close();
        push({ __done: true });
        return;
      }
      if (e.lastEventId) {
        const n = parseInt(e.lastEventId, 10);
        if (Number.isFinite(n)) cursor = n + 1;
      }
      try {
        push(JSON.parse(e.data) as StreamEvent);
      } catch {}
    };

    es.onerror = () => {
      if (es === activeEs) {
        es.close();
        push({ __reconnect: true });
      }
    };

    activeEs = es;
    return es;
  }

  let es = connect();

  const onVisibility = () => {
    if (document.visibilityState === 'visible') {
      es.onmessage = null;
      es.onerror = null;
      es.close();
      es = connect();
    }
  };
  document.addEventListener('visibilitychange', onVisibility);

  try {
    while (true) {
      const item = await pull();

      if ('__abort' in item) return;
      if ('__done' in item) return;

      if ('__reconnect' in item) {
        emptyRetries++;
        // If we never received any events, the job is likely gone
        if (!receivedAny || emptyRetries >= MAX_EMPTY_RETRIES) {
          return;
        }
        await new Promise((r) => setTimeout(r, 500 * Math.min(emptyRetries + 1, 4)));
        es = connect();
        continue;
      }

      yield item;
    }
  } finally {
    es.close();
    document.removeEventListener('visibilitychange', onVisibility);
  }
}
