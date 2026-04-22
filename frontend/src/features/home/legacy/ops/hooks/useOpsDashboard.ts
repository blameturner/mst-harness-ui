// frontend/src/features/hub/tabs/ops/hooks/useOpsDashboard.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { getOpsDashboard } from '../../../../../api/ops/getOpsDashboard';
import { getQueueDashboard } from '../../../../../api/queue/getQueueDashboard';
import { listQueueJobs } from '../../../../../api/queue/listQueueJobs';
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
  const genRef = useRef(0);
  const reconnectRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    if (orgId == null) return;
    const gen = ++genRef.current;
    setLoading(true);
    setError(null);
    setQueueUnavailable(null);
    try {
      const next = await getOpsDashboard({ org_id: orgId, limit });
      if (gen !== genRef.current) return;

      // Some backend builds can return partial /ops/dashboard payloads.
      // Fill queue-focused cards from dedicated queue endpoints when needed.
      const needsQueueDashboard =
        next.queue == null ||
        next.runtime == null ||
        next.scheduler == null ||
        next.active_summary == null ||
        next.queue_center?.backoff == null;
      const needsQueueJobs =
        next.queue_jobs == null ||
        !Array.isArray(next.queue_jobs.rows) ||
        next.queue_jobs.rows.length === 0;

      const [queueDashboardFallback, queueJobsFallback] = await Promise.all([
        needsQueueDashboard
          ? getQueueDashboard({ org_id: orgId, limit }).catch(() => null)
          : Promise.resolve(null),
        needsQueueJobs
          ? listQueueJobs({ org_id: orgId, limit: Math.max(limit, 20), verbose: true }).catch(() => null)
          : Promise.resolve(null),
      ]);

      const merged: OpsDashboardResponse = {
        ...next,
        queue: next.queue ?? queueDashboardFallback?.queue,
        runtime: next.runtime ?? queueDashboardFallback?.runtime,
        scheduler: next.scheduler ?? queueDashboardFallback?.scheduler,
        active_summary: next.active_summary ?? queueDashboardFallback?.active_summary,
        queue_jobs:
          next.queue_jobs ??
          (queueJobsFallback?.jobs
            ? { count: queueJobsFallback.jobs.length, rows: queueJobsFallback.jobs }
            : queueDashboardFallback?.recent_jobs
              ? {
                  count: queueDashboardFallback.recent_jobs.length,
                  rows: queueDashboardFallback.recent_jobs,
                }
              : undefined),
        queue_center: next.queue_center
          ? {
              ...next.queue_center,
              backoff: next.queue_center.backoff ?? queueDashboardFallback?.queue?.backoff,
              health:
                next.queue_center.health ??
                (queueDashboardFallback?.runtime
                  ? {
                      tool_queue_ready: queueDashboardFallback.runtime.tool_queue_ready,
                      huey_consumer_running: queueDashboardFallback.runtime.huey?.consumer_running,
                      huey_workers: queueDashboardFallback.runtime.huey?.workers,
                    }
                  : undefined),
            }
          : queueDashboardFallback?.queue || queueDashboardFallback?.runtime
            ? {
                backoff: queueDashboardFallback.queue?.backoff,
                health: {
                  tool_queue_ready: queueDashboardFallback.runtime?.tool_queue_ready,
                  huey_consumer_running: queueDashboardFallback.runtime?.huey?.consumer_running,
                  huey_workers: queueDashboardFallback.runtime?.huey?.workers,
                },
              }
            : undefined,
      };
      if (next.status === 'failed' && next.error === 'tool_queue_unavailable') {
        setQueueUnavailable('Tool queue is unavailable. Start or restore the Huey consumer/runtime and retry.');
      } else {
        setQueueUnavailable(null);
        setRuntimeFallback(null);
      }
      setData(merged);
      setLastReloadedAt(Date.now());
    } catch (err) {
      if (gen !== genRef.current) return;
      setError(extractApiFailure(err).message);
      try {
        const runtime = await getQueueRuntime();
        if (gen !== genRef.current) return;
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
      if (gen === genRef.current) setLoading(false);
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

  // Clear stale runtimeFallback when org changes
  useEffect(() => {
    setRuntimeFallback(null);
  }, [orgId]);

  // SSE subscription
  useEffect(() => {
    if (orgId == null) return;
    let active = true;

    function connect() {
      if (!active) return;
      const es = new EventSource(`${gatewayUrl()}/api/tool-queue/events`, { withCredentials: true });
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
        if (reconnectRef.current != null) window.clearTimeout(reconnectRef.current);
        reconnectRef.current = window.setTimeout(() => {
          reconnectRef.current = null;
          connect();
        }, 2000);
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
      if (reconnectRef.current != null) {
        window.clearTimeout(reconnectRef.current);
        reconnectRef.current = null;
      }
    };
  }, [orgId, scheduleRefresh]);

  const reload = useCallback(() => void load(), [load]);

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
    reload,
    lastReloadedAt,
  };
}
