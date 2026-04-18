// frontend/src/features/hub/tabs/ops/hooks/useOpsDashboard.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { getOpsDashboard } from '../../../../../api/ops/getOpsDashboard';
import { getQueueRuntime } from '../../../../../api/queue/getQueueRuntime';
import type { OpsDashboardResponse } from '../../../../../api/types/OpsDashboard';
import { gatewayUrl } from '../../../../../lib/runtime-env';
import type { QueueEvent } from '../../../../../api/types/QueueEvent';
import { extractApiFailure } from '../lib/formatters';

const DEBOUNCE_MS = 400;
const POLL_MS = 10_000;

export interface UseOpsDashboardResult {
  data: OpsDashboardResponse | null;
  loading: boolean;
  error: string | null;
  queueUnavailable: string | null;
  runtime: OpsDashboardResponse['runtime'] | undefined;
  reload: () => void;
  lastReloadedAt: number | null;
}

export function useOpsDashboard(orgId: number | null, limit = 20): UseOpsDashboardResult {
  const [data, setData] = useState<OpsDashboardResponse | null>(null);
  const [runtimeFallback, setRuntimeFallback] = useState<OpsDashboardResponse['runtime'] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queueUnavailable, setQueueUnavailable] = useState<string | null>(null);
  const [lastReloadedAt, setLastReloadedAt] = useState<number | null>(null);

  const debounceRef = useRef<number | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const pollRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    if (orgId == null) return;
    setLoading(true);
    setError(null);
    try {
      const next = await getOpsDashboard({ org_id: orgId, limit });
      if (next.status === 'failed' && next.error === 'tool_queue_unavailable') {
        setQueueUnavailable('Tool queue is unavailable. Start or restore the Huey consumer/runtime and retry.');
      } else {
        setQueueUnavailable(null);
      }
      setData(next);
      setLastReloadedAt(Date.now());
    } catch (err) {
      setError(extractApiFailure(err).message);
      try {
        const runtime = await getQueueRuntime();
        setRuntimeFallback({
          tool_queue_ready: runtime.tool_queue_ready,
          huey: runtime.huey,
        });
        if (runtime.tool_queue_ready === false || runtime.huey?.queue_ready === false) {
          setQueueUnavailable('Tool queue is unavailable. Verify Huey runtime and consumer are running.');
        }
      } catch {
        // Best-effort fallback.
      }
    } finally {
      setLoading(false);
    }
  }, [orgId, limit]);

  const scheduleRefresh = useCallback(() => {
    if (debounceRef.current != null) return;
    debounceRef.current = window.setTimeout(() => {
      debounceRef.current = null;
      void load();
    }, DEBOUNCE_MS);
  }, [load]);

  // Initial + orgId-driven load
  useEffect(() => {
    void load();
  }, [load]);

  // SSE subscription
  useEffect(() => {
    if (orgId == null) return;
    let active = true;

    function connect() {
      if (!active) return;
      const es = new EventSource(`${gatewayUrl()}/api/queue/events`, { withCredentials: true });
      esRef.current = es;
      es.onmessage = (e) => {
        try {
          const ev = JSON.parse(e.data) as QueueEvent;
          if (ev.type) scheduleRefresh();
        } catch {
          // keepalive / malformed payload — ignore
        }
      };
      es.onerror = () => {
        es.close();
        esRef.current = null;
        if (!active) return;
        window.setTimeout(connect, 2000);
      };
    }

    connect();
    return () => {
      active = false;
      esRef.current?.close();
      esRef.current = null;
      if (debounceRef.current != null) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [orgId, scheduleRefresh]);

  // Periodic poll, paused when tab is hidden.
  useEffect(() => {
    if (orgId == null) return;
    function tick() {
      if (document.visibilityState === 'visible') void load();
    }
    pollRef.current = window.setInterval(tick, POLL_MS);
    return () => {
      if (pollRef.current != null) window.clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [orgId, load]);

  return {
    data,
    loading,
    error,
    queueUnavailable,
    runtime: data?.runtime ?? runtimeFallback ?? undefined,
    reload: () => void load(),
    lastReloadedAt,
  };
}
