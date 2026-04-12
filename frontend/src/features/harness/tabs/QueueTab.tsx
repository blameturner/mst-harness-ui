import { useEffect, useRef, useState } from 'react';
import { getQueueStatus } from '../../../api/queue/getQueueStatus';
import { listQueueJobs } from '../../../api/queue/listQueueJobs';
import { cancelQueueJob } from '../../../api/queue/cancelQueueJob';
import { updateJobPriority } from '../../../api/queue/updateJobPriority';
import type { QueueStatus } from '../../../api/types/QueueStatus';
import type { QueueJob } from '../../../api/types/QueueJob';
import type { QueueEvent } from '../../../api/types/QueueEvent';
import { gatewayUrl } from '../../../lib/runtime-env';

export function QueueTab() {
  const [status, setStatus] = useState<QueueStatus | null>(null);
  const [jobs, setJobs] = useState<QueueJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  function reload() {
    Promise.all([getQueueStatus(), listQueueJobs()])
      .then(([s, j]) => {
        setStatus(s);
        setJobs(j.jobs);
      })
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    reload();

    const es = new EventSource(`${gatewayUrl()}/api/queue/events`, { withCredentials: true });
    esRef.current = es;

    es.onmessage = (e) => {
      try {
        const ev = JSON.parse(e.data) as QueueEvent;
        // On any queue state change, reload the full state.
        // Queue events are infrequent, so a full reload is fine.
        if (ev.type) reload();
      } catch {}
    };

    es.onerror = () => {
      // SSE will auto-reconnect
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, []);

  async function handleCancel(jobId: string) {
    try {
      await cancelQueueJob(jobId);
      reload();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handlePriority(jobId: string, delta: number) {
    const job = jobs.find((j) => j.job_id === jobId);
    if (!job) return;
    const next = Math.min(5, Math.max(1, job.priority + delta));
    if (next === job.priority) return;
    try {
      await updateJobPriority(jobId, next);
      reload();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (loading) {
    return (
      <div className="px-8 py-6 text-muted text-sm font-sans">Loading queue…</div>
    );
  }

  return (
    <div className="px-8 py-6 space-y-6">
      <h2 className="font-display text-xl">Job queue</h2>

      {error && (
        <div className="text-[13px] text-red-500 font-sans">{error}</div>
      )}

      {status && (
        <div className="grid grid-cols-3 gap-4">
          <div className="border border-border rounded-lg p-4">
            <div className="text-[10px] uppercase tracking-[0.16em] text-muted font-sans mb-1">Queue length</div>
            <div className="font-display text-2xl">{status.queue_length}</div>
          </div>
          <div className="border border-border rounded-lg p-4">
            <div className="text-[10px] uppercase tracking-[0.16em] text-muted font-sans mb-1">Current job</div>
            <div className="font-display text-lg">
              {status.current_job
                ? `${status.current_job.type} (${Math.round(status.current_job.elapsed_s)}s)`
                : 'Idle'}
            </div>
          </div>
          <div className="border border-border rounded-lg p-4">
            <div className="text-[10px] uppercase tracking-[0.16em] text-muted font-sans mb-1">Estimated wait</div>
            <div className="font-display text-2xl">{Math.round(status.estimated_wait_s)}s</div>
          </div>
        </div>
      )}

      {jobs.length === 0 ? (
        <p className="text-muted text-sm font-sans">No jobs in the queue.</p>
      ) : (
        <table className="w-full text-sm font-sans">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-[0.16em] text-muted border-b border-border">
              <th className="pb-2 pr-4">Job ID</th>
              <th className="pb-2 pr-4">Type</th>
              <th className="pb-2 pr-4">Status</th>
              <th className="pb-2 pr-4">Priority</th>
              <th className="pb-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.job_id} className="border-b border-border/50">
                <td className="py-2.5 pr-4 text-muted font-mono text-xs">{job.job_id.slice(0, 8)}</td>
                <td className="py-2.5 pr-4">{job.type}</td>
                <td className="py-2.5 pr-4">
                  <span
                    className={[
                      'text-[10px] uppercase tracking-[0.14em] px-2 py-0.5 rounded border',
                      job.status === 'running'
                        ? 'border-fg/30 text-fg'
                        : job.status === 'completed'
                        ? 'border-emerald-600/40 text-emerald-500'
                        : job.status === 'failed'
                        ? 'border-red-600/40 text-red-500'
                        : 'border-border text-muted',
                    ].join(' ')}
                  >
                    {job.status}
                  </span>
                </td>
                <td className="py-2.5 pr-4">
                  <div className="flex items-center gap-1">
                    {job.status === 'queued' && (
                      <button
                        type="button"
                        onClick={() => handlePriority(job.job_id, 1)}
                        className="w-5 h-5 rounded border border-border text-muted hover:text-fg hover:border-fg text-xs"
                        title="Increase priority"
                      >
                        ↑
                      </button>
                    )}
                    <span className="text-xs tabular-nums w-4 text-center">{job.priority}</span>
                    {job.status === 'queued' && (
                      <button
                        type="button"
                        onClick={() => handlePriority(job.job_id, -1)}
                        className="w-5 h-5 rounded border border-border text-muted hover:text-fg hover:border-fg text-xs"
                        title="Decrease priority"
                      >
                        ↓
                      </button>
                    )}
                  </div>
                </td>
                <td className="py-2.5">
                  {(job.status === 'queued' || job.status === 'running') && (
                    <button
                      type="button"
                      onClick={() => handleCancel(job.job_id)}
                      className="text-[10px] uppercase tracking-[0.14em] font-sans px-2 py-1 rounded border border-red-600/40 text-red-500 hover:bg-red-600 hover:text-bg transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
