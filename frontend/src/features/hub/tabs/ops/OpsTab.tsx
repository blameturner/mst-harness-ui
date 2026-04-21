// frontend/src/features/hub/tabs/ops/OpsTab.tsx
import { useEffect, useState } from 'react';
import { orgMe } from '../../../../api/auth/orgMe';
import { startScraper } from '../../../../api/enrichment/scraper';
import { startPathfinder } from '../../../../api/enrichment/pathfinder';
import { startDiscoverAgent } from '../../../../api/enrichment/startDiscoverAgent';
import { extractApiFailure, asNumber, formatKick } from './lib/formatters';
import { useOpsDashboard } from './hooks/useOpsDashboard';
import { BackoffLight } from './components/BackoffLight';
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
        <BackoffLight backoff={dashboard.data?.queue_center?.backoff ?? dashboard.data?.queue?.backoff} />
        {kickStatus && (
          <span className="ml-auto text-[11px] uppercase tracking-[0.14em] text-muted">{kickStatus}</span>
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

