// frontend/src/features/hub/tabs/ops/OpsTab.tsx
import { useEffect, useState } from 'react';
import { orgMe } from '../../../../api/auth/orgMe';
import { startScraper } from '../../../../api/enrichment/scraper';
import { startPathfinder } from '../../../../api/enrichment/pathfinder';
import { startDiscoverAgent } from '../../../../api/enrichment/startDiscoverAgent';
import { retryQueueJob } from '../../../../api/queue/retryQueueJob';
import type { QueueJob } from '../../../../api/types/QueueJob';
import { extractApiFailure, asNumber, formatKick } from './lib/formatters';
import { useOpsDashboard } from './hooks/useOpsDashboard';
import { PipelineRibbon } from './components/PipelineRibbon';
import { NextCandidatePanel } from './components/NextCandidatePanel';
import { SuggestionsPanel } from './components/SuggestionsPanel';
import { ScrapeTargetsPanel } from './components/ScrapeTargetsPanel';
import { QueueJobsPanel } from './components/QueueJobsPanel';

type SubTab = 'suggestions' | 'scrape-targets' | 'queue';

function getOrgIdFromMe(payload: unknown): number | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as { org?: Record<string, unknown> };
  const org = p.org;
  if (!org) return null;
  return asNumber(org.id ?? org.Id ?? org.org_id);
}

export function OpsTab() {
  const [orgId, setOrgId] = useState<number | null>(null);
  const [orgInput, setOrgInput] = useState('');
  const [subTab, setSubTab] = useState<SubTab>('suggestions');

  const dashboard = useOpsDashboard(orgId);

  const [busyKick, setBusyKick] = useState<'scraper' | 'pathfinder' | 'discover' | null>(null);
  const [kickStatus, setKickStatus] = useState<string | null>(null);
  const [retryBusy, setRetryBusy] = useState<string | null>(null);
  const [retryStatus, setRetryStatus] = useState<string | null>(null);

  const triggersDisabled = !!dashboard.queueUnavailable;

  useEffect(() => {
    orgMe()
      .then((r) => {
        const id = getOrgIdFromMe(r);
        if (id != null) {
          setOrgId(id);
          setOrgInput(String(id));
        }
      })
      .catch(() => {});
  }, []);

  async function kick(kind: 'scraper' | 'pathfinder' | 'discover') {
    setBusyKick(kind);
    setKickStatus(null);
    try {
      const res =
        kind === 'scraper'
          ? await startScraper(orgId ?? undefined)
          : kind === 'pathfinder'
            ? await startPathfinder(orgId ?? undefined)
            : await startDiscoverAgent(orgId ?? undefined);
      setKickStatus(`${kind}: ${formatKick(res)}`);
      dashboard.reload();
    } catch (err) {
      setKickStatus(`${kind}: error ${extractApiFailure(err).message}`);
    } finally {
      setBusyKick(null);
      window.setTimeout(() => setKickStatus(null), 6000);
    }
  }

  async function retry(jobId: string) {
    setRetryBusy(jobId);
    setRetryStatus(null);
    try {
      const res = await retryQueueJob(jobId);
      setRetryStatus(res.status === 'queued' ? `Retried ${jobId}` : `Retry ${res.status}${res.error ? `: ${res.error}` : ''}`);
      dashboard.reload();
    } catch (err) {
      setRetryStatus(`Retry failed: ${extractApiFailure(err).message}`);
    } finally {
      setRetryBusy(null);
      window.setTimeout(() => setRetryStatus(null), 6000);
    }
  }

  const queueRows = dashboard.data?.queue_jobs?.rows ?? [];
  const activeRows = queueRows.filter((j) => j.status === 'queued' || j.status === 'running');
  const failedRows = queueRows.filter((j) => j.status === 'failed').slice(0, 8);
  const groupedActive = groupActive(activeRows);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-end gap-3 flex-wrap">
        <div>
          <label className="block text-[11px] uppercase tracking-[0.14em] text-muted mb-1.5">Org ID</label>
          <input
            value={orgInput}
            onChange={(e) => setOrgInput(e.target.value)}
            className="px-3 py-2 w-32 rounded border border-border bg-panel text-fg text-sm font-sans"
            placeholder="1"
          />
        </div>
        <button
          type="button"
          onClick={() => {
            const parsed = asNumber(orgInput);
            if (parsed != null) setOrgId(parsed);
          }}
          className="px-3 py-2 rounded border border-border text-[11px] uppercase tracking-[0.14em] hover:bg-panel"
        >
          Apply
        </button>
        <button
          type="button"
          onClick={() => dashboard.reload()}
          className="px-3 py-2 rounded border border-border text-[11px] uppercase tracking-[0.14em] hover:bg-panel"
        >
          Refresh
        </button>
        {kickStatus && (
          <span className="ml-auto text-[11px] uppercase tracking-[0.14em] text-muted">{kickStatus}</span>
        )}
        {retryStatus && (
          <span className="text-[11px] uppercase tracking-[0.14em] text-muted">{retryStatus}</span>
        )}
      </div>

      {dashboard.queueUnavailable && (
        <div className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          <span className="font-medium">Queue service health:</span> {dashboard.queueUnavailable}
        </div>
      )}
      {dashboard.error && <p className="text-xs text-red-500">{dashboard.error}</p>}

      <PipelineRibbon
        pipeline={dashboard.data?.pipeline}
        runtime={dashboard.runtime}
        backoff={dashboard.data?.queue_center?.backoff ?? dashboard.data?.queue?.backoff}
        triggersDisabled={triggersDisabled}
        busy={busyKick}
        onKick={kick}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <section className="border border-border rounded p-3 space-y-2">
          <p className="text-[10px] uppercase tracking-[0.16em] text-muted">Runtime health</p>
          <p className="text-sm">tool_queue_ready: {String(dashboard.runtime?.tool_queue_ready ?? '-')}</p>
          <p className="text-sm">huey enabled: {String(dashboard.runtime?.huey?.enabled ?? '-')}</p>
          <p className="text-sm">consumer: {dashboard.runtime?.huey?.consumer_running ? 'running' : 'stopped'}</p>
          <p className="text-sm">workers: {dashboard.runtime?.huey?.workers ?? '-'}</p>
          <p className="text-sm">backoff: {dashboard.data?.queue?.backoff?.state ?? '-'}</p>
          <p className="text-sm">idle seconds: {dashboard.data?.queue?.backoff?.idle_seconds ?? '-'}</p>
        </section>

        <section className="border border-border rounded p-3 space-y-2">
          <p className="text-[10px] uppercase tracking-[0.16em] text-muted">Scheduler</p>
          <p className="text-sm">next agent run: {dashboard.data?.scheduler?.next_run ?? '-'}</p>
          <p className="text-sm">next enrichment run: {dashboard.data?.scheduler?.next_enrichment_run ?? '-'}</p>
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted pt-1">Agent schedules</p>
          {(dashboard.data?.scheduler?.agent_schedules ?? []).slice(0, 4).map((s) => (
            <p key={`agent-${s.id}`} className="text-xs">{s.id}: {s.next_run ?? '-'}</p>
          ))}
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted pt-1">Enrichment schedules</p>
          {(dashboard.data?.scheduler?.enrichment_schedules ?? []).slice(0, 4).map((s) => (
            <p key={`enrich-${s.id}`} className="text-xs">{s.id}: {s.next_run ?? '-'}</p>
          ))}
        </section>

        <section className="border border-border rounded p-3 space-y-2">
          <p className="text-[10px] uppercase tracking-[0.16em] text-muted">Active summary</p>
          <p className="text-sm">active: {dashboard.data?.active_summary?.active ?? 0}</p>
          <p className="text-sm">queued: {dashboard.data?.active_summary?.queued ?? 0}</p>
          <p className="text-sm">running: {dashboard.data?.active_summary?.running ?? 0}</p>
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted pt-1">Active by type/source</p>
          {groupedActive.length === 0 ? (
            <p className="text-xs text-muted">No queued/running jobs</p>
          ) : (
            groupedActive.slice(0, 8).map((g) => (
              <p key={`${g.type}-${g.source}`} className="text-xs">
                {g.type} / {g.source}: {g.count}
              </p>
            ))
          )}
        </section>
      </div>

      <section className="border border-border rounded p-3 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-[0.16em] text-muted">Recent failures</p>
        </div>
        {failedRows.length === 0 ? (
          <p className="text-xs text-muted">No failed jobs in current slice.</p>
        ) : (
          <div className="space-y-1">
            {failedRows.map((job) => (
              <div key={job.job_id} className="flex items-center gap-2 text-xs">
                <span className="font-mono text-muted">{job.job_id.slice(0, 8)}</span>
                <span>{job.type}</span>
                <span className="text-muted">{job.error || '-'}</span>
                <button
                  type="button"
                  onClick={() => void retry(job.job_id)}
                  disabled={triggersDisabled || retryBusy === job.job_id}
                  className="ml-auto px-2 py-1 rounded border border-border text-[10px] uppercase tracking-[0.12em] hover:bg-panel disabled:opacity-50"
                >
                  {retryBusy === job.job_id ? 'Retrying…' : 'Retry'}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_22rem] gap-4">
        <div className="space-y-3 min-w-0">
          <nav className="flex gap-1 border-b border-border">
            {(['suggestions', 'scrape-targets', 'queue'] as const).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setSubTab(id)}
                className={[
                  'px-3 py-2 text-[11px] uppercase tracking-[0.18em] font-sans border-b-2 -mb-px transition-colors',
                  subTab === id ? 'border-fg text-fg' : 'border-transparent text-muted hover:text-fg',
                ].join(' ')}
              >
                {id === 'suggestions' ? 'Suggestions' : id === 'scrape-targets' ? 'Scrape targets' : 'Queue jobs'}
              </button>
            ))}
          </nav>

          {subTab === 'suggestions' && (
            <SuggestionsPanel
              orgId={orgId}
              onActionComplete={dashboard.reload}
              loading={dashboard.loading}
            />
          )}
          {subTab === 'scrape-targets' && (
            <ScrapeTargetsPanel
              scrapeTargets={dashboard.data?.scrape_targets}
              scraperPreview={dashboard.data?.pipeline?.next_candidates?.scraper ?? null}
              triggersDisabled={triggersDisabled}
              onActionComplete={dashboard.reload}
              loading={dashboard.loading}
            />
          )}
          {subTab === 'queue' && (
            <QueueJobsPanel
              queueJobs={dashboard.data?.queue_jobs}
              triggersDisabled={triggersDisabled}
              onActionComplete={dashboard.reload}
              loading={dashboard.loading}
            />
          )}
        </div>

        <NextCandidatePanel
          pathfinder={dashboard.data?.pipeline?.next_candidates?.pathfinder ?? null}
          scraper={dashboard.data?.pipeline?.next_candidates?.scraper ?? null}
          lastEvaluatedAt={dashboard.lastReloadedAt}
          onReevaluate={dashboard.reload}
        />
      </div>
    </div>
  );
}

function groupActive(rows: QueueJob[]) {
  const map = new Map<string, { type: string; source: string; count: number }>();
  for (const row of rows) {
    const key = `${row.type}::${row.source}`;
    const prev = map.get(key);
    if (prev) {
      prev.count += 1;
      continue;
    }
    map.set(key, {
      type: row.type || 'unknown',
      source: row.source || 'unknown',
      count: 1,
    });
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

