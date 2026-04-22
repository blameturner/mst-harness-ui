import { useEffect, useState, useCallback } from 'react';
import { health } from '../../../api/health/health';
import { getQueueStatus } from '../../../api/queue/getQueueStatus';
import { listQueueJobs } from '../../../api/queue/listQueueJobs';
import { getHarnessStats } from '../../../api/harness/getHarnessStats';
import { listResearchPlans } from '../../../api/enrichment/research';
import type { QueueStatus } from '../../../api/types/QueueStatus';
import type { QueueJob } from '../../../api/types/QueueJob';
import type { HarnessStats } from '../../../api/types/HarnessStats';
import { formatNumber } from '../../../lib/utils/formatNumber';

interface ResearchStats {
  pending: number;
  generating: number;
  complete: number;
  failed: number;
}

export function HomeTab() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [recentJobs, setRecentJobs] = useState<QueueJob[]>([]);
  const [todayStats, setTodayStats] = useState<HarnessStats | null>(null);
  const [researchStats, setResearchStats] = useState<ResearchStats>({ pending: 0, generating: 0, complete: 0, failed: 0 });
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [healthRes, queueStatusRes, jobsRes, statsRes, researchRes] = await Promise.all([
        health(),
        getQueueStatus(),
        listQueueJobs({ limit: 5 }),
        getHarnessStats('7d'),
        listResearchPlans(),
      ]);

      setConnected(healthRes.harness === 'ok');
      setLastUpdated(new Date());
      setQueueStatus(queueStatusRes);
      setRecentJobs(jobsRes.jobs);

      const today = new Date().toISOString().split('T')[0];
      const todayData = statsRes.by_day.find((d) => d.date === today);
      if (todayData) {
        setTodayStats({
          ...statsRes,
          total_requests: todayData.requests,
          total_tokens_input: todayData.tokens_input,
          total_tokens_output: todayData.tokens_output,
          total_errors: todayData.errors,
          total_conversations: 0,
          by_model: [],
          by_day: [todayData],
          by_hour: [],
          by_style: [],
          top_conversations: [],
          agent_runs: { total_runs: 0, successful: 0, failed: 0, avg_steps: 0, by_agent: [] },
          period_start: todayData.date,
          period_end: todayData.date,
        });
      } else {
        setTodayStats({
          ...statsRes,
          total_requests: 0,
          total_tokens_input: 0,
          total_tokens_output: 0,
          total_errors: 0,
          total_conversations: 0,
          by_model: [],
          by_day: [],
          by_hour: [],
          by_style: [],
          top_conversations: [],
          agent_runs: { total_runs: 0, successful: 0, failed: 0, avg_steps: 0, by_agent: [] },
          period_start: '',
          period_end: '',
        });
      }

      const researchItems = researchRes.items;
      setResearchStats({
        pending: researchItems.filter((i) => i.status === 'pending').length,
        generating: researchItems.filter((i) => i.status === 'generating').length,
        complete: researchItems.filter((i) => i.status === 'completed').length,
        failed: researchItems.filter((i) => i.status === 'failed').length,
      });
    } catch {
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30_000);
    return () => clearInterval(interval);
  }, [loadData]);

  const formatTime = (date: Date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const queueTypes = queueStatus ? Object.entries(queueStatus.counts) : [];
  const totalQueued = queueTypes.reduce((sum, [, c]) => sum + c.queued, 0);
  const totalRunning = queueTypes.reduce((sum, [, c]) => sum + c.running, 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            className={`inline-block w-2.5 h-2.5 rounded-full ${
              loading ? 'bg-border animate-blink' : connected ? 'bg-emerald-500' : 'bg-red-500'
            }`}
          />
          <span className="text-sm font-sans text-fg">
            {loading ? 'Connecting...' : connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        {lastUpdated && <span className="text-[11px] text-muted">Last updated: {formatTime(lastUpdated)}</span>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="border border-border rounded p-4 bg-panel/30">
          <h3 className="text-[10px] uppercase tracking-[0.14em] text-muted mb-3">Queue</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted">Queued</span>
              <span className="text-sm font-mono text-fg">{totalQueued}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted">Running</span>
              <span className="text-sm font-mono text-fg">{totalRunning}</span>
            </div>
          </div>
          {queueTypes.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border space-y-1">
              {queueTypes.map(([type, counts]) => (
                <div key={type} className="flex justify-between text-[11px]">
                  <span className="text-muted capitalize">{type.replace('_', ' ')}</span>
                  <span className="text-fg">
                    {counts.queued > 0 && `${counts.queued}q `}
                    {counts.running > 0 && `${counts.running}r`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border border-border rounded p-4 bg-panel/30">
          <h3 className="text-[10px] uppercase tracking-[0.14em] text-muted mb-3">Today&apos;s Usage</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted">Requests</span>
              <span className="text-sm font-mono text-fg">{todayStats?.total_requests ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted">Tokens in</span>
              <span className="text-sm font-mono text-fg">{formatNumber(todayStats?.total_tokens_input ?? 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted">Tokens out</span>
              <span className="text-sm font-mono text-fg">{formatNumber(todayStats?.total_tokens_output ?? 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted">Errors</span>
              <span className="text-sm font-mono text-fg">
                {todayStats?.total_errors ?? 0}
                {todayStats && todayStats.total_requests > 0 && (
                  <span className="text-muted"> ({((todayStats.total_errors / todayStats.total_requests) * 100).toFixed(1)}%)</span>
                )}
              </span>
            </div>
          </div>
        </div>

        <div className="border border-border rounded p-4 bg-panel/30">
          <h3 className="text-[10px] uppercase tracking-[0.14em] text-muted mb-3">Research Plans</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted">Pending</span>
              <span className="text-sm font-mono text-fg">{researchStats.pending}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted">Generating</span>
              <span className="text-sm font-mono text-blue-400">{researchStats.generating}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted">Complete</span>
              <span className="text-sm font-mono text-emerald-400">{researchStats.complete}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted">Failed</span>
              <span className="text-sm font-mono text-red-400">{researchStats.failed}</span>
            </div>
          </div>
        </div>
      </div>

      {recentJobs.length > 0 && (
        <div className="border border-border rounded">
          <div className="px-4 py-3 bg-panel/50 border-b border-border">
            <h3 className="text-[10px] uppercase tracking-[0.14em] text-muted">Recent Jobs</h3>
          </div>
          <div className="divide-y divide-border">
            {recentJobs.map((job) => (
              <div key={job.job_id} className="px-4 py-3 flex items-center justify-between hover:bg-panel/30">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs font-mono text-fg truncate">{job.job_id.slice(0, 12)}...</span>
                  <span className="text-xs text-muted capitalize">{job.type?.replace('_', ' ') || 'unknown'}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className={`text-[10px] uppercase tracking-[0.1em] px-2 py-0.5 rounded ${
                      job.status === 'completed'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : job.status === 'failed'
                        ? 'bg-red-500/20 text-red-400'
                        : job.status === 'running'
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'bg-panel text-muted'
                    }`}
                  >
                    {job.status}
                  </span>
                  <span className="text-[10px] text-muted">P{job.priority}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}