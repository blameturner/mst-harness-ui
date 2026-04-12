import { gatewayUrl } from '../lib/runtime-env';
import type { StreamEvent } from './types/StreamEvent';

export async function* streamJob(
  path: string,
  body: unknown,
  signal?: AbortSignal,
): AsyncGenerator<StreamEvent, void, void> {
  const res = await fetch(`${gatewayUrl()}/${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    let detail = '';
    try {
      detail = await res.text();
    } catch {}
    yield { type: 'error', message: `HTTP ${res.status}${detail ? `: ${detail.slice(0, 300)}` : ''}` };
    return;
  }

  const initData = (await res.json()) as { job_id: string; estimate?: string };
  const { job_id } = initData;
  if (!job_id) {
    yield { type: 'error', message: 'No job_id returned' };
    return;
  }
  if (initData.estimate) {
    yield { type: 'meta', estimate: initData.estimate };
  }

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

  // Wire abort signal to wake the pull loop
  signal?.addEventListener('abort', () => push({ __abort: true }));

  let cursor = 0;
  let emptyRetries = 0;
  let activeEs: EventSource | null = null;
  const MAX_EMPTY_RETRIES = 8;

  function connect() {
    const streamUrl = `${gatewayUrl()}/api/stream/${encodeURIComponent(job_id)}?cursor=${cursor}`;
    const es = new EventSource(streamUrl, { withCredentials: true });

    es.onopen = () => { emptyRetries = 0; };

    es.onmessage = (e) => {
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
      // Only push reconnect if this is still the active EventSource
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
      // Detach old ES handlers before closing to prevent spurious __reconnect
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
        if (emptyRetries >= MAX_EMPTY_RETRIES) {
          yield { type: 'error', message: 'Stream connection lost' };
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
