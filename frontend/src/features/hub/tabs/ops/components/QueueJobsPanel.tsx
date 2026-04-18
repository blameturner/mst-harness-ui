// frontend/src/features/hub/tabs/ops/components/QueueJobsPanel.tsx
import { useMemo, useState } from 'react';
import { cancelQueueJob } from '../../../../../api/queue/cancelQueueJob';
import { getQueueJob } from '../../../../../api/queue/getQueueJob';
import { retryQueueJob } from '../../../../../api/queue/retryQueueJob';
import { updateJobPriority } from '../../../../../api/queue/updateJobPriority';
import type { OpsDashboardResponse } from '../../../../../api/types/OpsDashboard';
import type { QueueJob } from '../../../../../api/types/QueueJob';
import { extractApiFailure, fmt, fmtWhen, safeStringify } from '../lib/formatters';
import { RowDrawer } from './RowDrawer';
import { StatusChip } from './StatusChip';

type Filter = 'all' | 'running' | 'failed' | 'waiting' | 'completed';

const RETRY_STATUSES: ReadonlySet<QueueJob['status']> = new Set(['completed', 'failed', 'cancelled']);

export interface QueueJobsPanelProps {
  queueJobs?: OpsDashboardResponse['queue_jobs'];
  triggersDisabled?: boolean;
  onActionComplete: () => void;
  loading?: boolean;
}

export function QueueJobsPanel({
  queueJobs,
  triggersDisabled,
  onActionComplete,
  loading,
}: QueueJobsPanelProps) {
  const rows = useMemo(() => queueJobs?.rows ?? [], [queueJobs]);
  const [filter, setFilter] = useState<Filter>('all');
  const filtered = useMemo(() => filterJobs(rows, filter), [rows, filter]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerId, setDrawerId] = useState<string>('');
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerError, setDrawerError] = useState<string | null>(null);
  const [drawerData, setDrawerData] = useState<QueueJob | null>(null);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  async function openDrawer(id: string) {
    setDrawerId(id);
    setDrawerOpen(true);
    setDrawerLoading(true);
    setDrawerError(null);
    setDrawerData(null);
    try {
      const job = await getQueueJob(id);
      setDrawerData(job);
    } catch (err) {
      setDrawerError(extractApiFailure(err).message);
    } finally {
      setDrawerLoading(false);
    }
  }

  async function withAction(id: string, fn: () => Promise<void>) {
    setBusyId(id);
    setActionMessage(null);
    try {
      await fn();
      onActionComplete();
    } catch (err) {
      setActionMessage(`error: ${extractApiFailure(err).message}`);
    } finally {
      setBusyId(null);
      window.setTimeout(() => setActionMessage(null), 6000);
    }
  }

  async function handleCancel(jobId: string) {
    await withAction(jobId, async () => {
      await cancelQueueJob(jobId);
      setActionMessage(`cancelled ${jobId}`);
    });
  }

  async function handleRetry(jobId: string) {
    await withAction(jobId, async () => {
      const res = await retryQueueJob(jobId);
      if (res.status === 'queued') {
        setActionMessage(`retried ${jobId} → ${res.job_id ?? '?'}`);
      } else {
        setActionMessage(`retry ${res.status}: ${res.error ?? ''}`);
      }
    });
  }

  async function handlePriority(job: QueueJob, delta: number) {
    const next = Math.min(5, Math.max(1, job.priority + delta));
    if (next === job.priority) return;
    await withAction(job.job_id, async () => {
      await updateJobPriority(job.job_id, next);
      setActionMessage(`priority ${job.job_id} → ${next}`);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <FilterChips
          value={filter}
          onChange={setFilter}
          options={[
            { id: 'all', label: 'All' },
            { id: 'running', label: 'Running' },
            { id: 'failed', label: 'Failed' },
            { id: 'waiting', label: 'Waiting' },
            { id: 'completed', label: 'Completed' },
          ]}
        />
        {actionMessage && (
          <span className="text-[11px] uppercase tracking-[0.14em] text-muted">{actionMessage}</span>
        )}
      </div>

      <div className="overflow-x-auto border border-border rounded">
        <table className="w-full text-sm font-sans">
          <thead className="bg-panel/50 text-[10px] uppercase tracking-[0.14em] text-muted">
            <tr>
              <th className="px-3 py-2 text-left">Job ID</th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Priority</th>
              <th className="px-3 py-2 text-left">Source</th>
              <th className="px-3 py-2 text-left">Task</th>
              <th className="px-3 py-2 text-left">Result</th>
              <th className="px-3 py-2 text-left">Error</th>
              <th className="px-3 py-2 text-left">Started</th>
              <th className="px-3 py-2 text-left">Completed</th>
              <th className="px-3 py-2 text-left">Claimed by</th>
              <th className="px-3 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((job) => (
              <tr key={job.job_id} className="hover:bg-panel/30">
                <td className="px-3 py-2 font-mono text-xs text-muted">{job.job_id.slice(0, 8)}</td>
                <td className="px-3 py-2">{job.type}</td>
                <td className="px-3 py-2"><StatusChip status={job.status} /></td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1">
                    {job.status === 'queued' && (
                      <button
                        type="button"
                        onClick={() => void handlePriority(job, 1)}
                        disabled={triggersDisabled || busyId === job.job_id}
                        className="w-5 h-5 rounded border border-border text-muted hover:text-fg hover:border-fg text-xs disabled:opacity-50"
                        title="Increase"
                      >
                        ↑
                      </button>
                    )}
                    <span className="tabular-nums w-4 text-center">{job.priority}</span>
                    {job.status === 'queued' && (
                      <button
                        type="button"
                        onClick={() => void handlePriority(job, -1)}
                        disabled={triggersDisabled || busyId === job.job_id}
                        className="w-5 h-5 rounded border border-border text-muted hover:text-fg hover:border-fg text-xs disabled:opacity-50"
                        title="Decrease"
                      >
                        ↓
                      </button>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2">{fmt(job.source)}</td>
                <td className="px-3 py-2 max-w-[18rem] truncate">{fmt(job.task)}</td>
                <td className="px-3 py-2">{fmt(job.result_status)}</td>
                <td className="px-3 py-2 max-w-[14rem] truncate">{fmt(job.error)}</td>
                <td className="px-3 py-2">{fmtWhen(job.started_at)}</td>
                <td className="px-3 py-2">{fmtWhen(job.completed_at)}</td>
                <td className="px-3 py-2">{fmt(job.claimed_by)}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1">
                    {(job.status === 'queued' || job.status === 'running') && (
                      <button
                        type="button"
                        onClick={() => void handleCancel(job.job_id)}
                        disabled={triggersDisabled || busyId === job.job_id}
                        className="px-2 py-1 rounded border border-red-600/40 text-red-400 text-[10px] uppercase tracking-[0.12em] hover:bg-red-600 hover:text-bg disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    )}
                    {RETRY_STATUSES.has(job.status) && (
                      <button
                        type="button"
                        onClick={() => void handleRetry(job.job_id)}
                        disabled={triggersDisabled || busyId === job.job_id}
                        className="px-2 py-1 rounded border border-border text-[10px] uppercase tracking-[0.12em] hover:bg-panel disabled:opacity-50"
                      >
                        Retry
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void openDrawer(job.job_id)}
                      className="px-2 py-1 rounded border border-border text-[10px] uppercase tracking-[0.12em] hover:bg-panel"
                    >
                      Open
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={12} className="px-3 py-6 text-center text-muted text-xs">
                  No jobs
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <RowDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        kind="job"
        id={drawerId}
        loading={drawerLoading}
        error={drawerError}
        data={drawerData}
        extra={
          drawerData ? (
            <>
              <details open>
                <summary className="text-[11px] uppercase tracking-[0.14em] text-muted cursor-pointer">Payload</summary>
                <pre className="mt-2 p-3 rounded border border-border bg-panel/60 text-xs whitespace-pre-wrap break-words">
                  {safeStringify(drawerData.payload)}
                </pre>
              </details>
              <details open>
                <summary className="text-[11px] uppercase tracking-[0.14em] text-muted cursor-pointer">Result</summary>
                <pre className="mt-2 p-3 rounded border border-border bg-panel/60 text-xs whitespace-pre-wrap break-words">
                  {safeStringify(drawerData.result)}
                </pre>
              </details>
            </>
          ) : null
        }
      />
    </div>
  );
}

function filterJobs(jobs: QueueJob[], filter: Filter) {
  switch (filter) {
    case 'all':
      return jobs;
    case 'running':
      return jobs.filter((j) => j.status === 'running');
    case 'failed':
      return jobs.filter((j) => j.status === 'failed');
    case 'waiting':
      return jobs.filter((j) => j.status === 'queued');
    case 'completed':
      return jobs.filter((j) => j.status === 'completed');
  }
}

interface FilterOpt<T extends string> {
  id: T;
  label: string;
}

function FilterChips<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (next: T) => void;
  options: ReadonlyArray<FilterOpt<T>>;
}) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={[
            'px-2 py-1 rounded border text-[10px] uppercase tracking-[0.14em]',
            value === o.id ? 'border-fg text-fg' : 'border-border text-muted hover:text-fg',
          ].join(' ')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
