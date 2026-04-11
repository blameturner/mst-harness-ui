import { useEffect, useState } from 'react';
import type { SchedulerStatus } from '../../api/types/SchedulerStatus';
import { getEnrichmentSchedulerStatus } from '../../api/enrichment/getEnrichmentSchedulerStatus';
import { triggerEnrichmentCycle } from '../../api/enrichment/triggerEnrichmentCycle';
import { StatusBadge } from './StatusBadge';
import { SourcesTab } from './tabs/sources/SourcesTab';
import { AgentsTab } from './tabs/agents/AgentsTab';
import { SuggestionsTab } from './tabs/suggestions/SuggestionsTab';
import { LogTab } from './tabs/log/LogTab';
import type { Tab } from './types/Tab';

export function EnrichmentContent() {
  const [tab, setTab] = useState<Tab>('sources');
  const [status, setStatus] = useState<SchedulerStatus | null>(null);
  const [triggering, setTriggering] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const s = await getEnrichmentSchedulerStatus();
        if (!cancelled) setStatus(s);
      } catch {
        if (!cancelled) setStatus(null);
      }
    }
    load();
    const id = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  async function triggerCycle() {
    setTriggering(true);
    setBanner(null);
    try {
      await triggerEnrichmentCycle();
      setBanner('Cycle triggered — watch the Log tab for progress.');
    } catch (err) {
      setBanner(`Trigger failed: ${(err as Error).message}`);
    } finally {
      setTriggering(false);
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'sources', label: 'Sources' },
    { id: 'agents', label: 'Agents' },
    { id: 'suggestions', label: 'Suggestions' },
    { id: 'log', label: 'Log' },
  ];

  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 border-b border-border px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <StatusBadge status={status} />
        </div>
        <button
          onClick={triggerCycle}
          disabled={triggering}
          className="text-[11px] uppercase tracking-[0.18em] font-sans border border-fg px-3 py-2 hover:bg-fg hover:text-bg transition-colors disabled:opacity-50"
        >
          {triggering ? 'triggering…' : 'run cycle now'}
        </button>
      </div>

      {banner && (
        <div className="shrink-0 px-8 py-3 bg-panel border-b border-border text-sm text-muted font-sans">
          {banner}
        </div>
      )}

      <nav className="shrink-0 border-b border-border px-8 flex gap-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={[
              'px-4 py-3 text-[11px] uppercase tracking-[0.18em] font-sans border-b-2 -mb-px transition-colors',
              tab === t.id ? 'border-fg text-fg' : 'border-transparent text-muted hover:text-fg',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="flex-1 min-h-0 overflow-y-auto px-8 py-6">
        {tab === 'sources' && <SourcesTab />}
        {tab === 'agents' && <AgentsTab />}
        {tab === 'suggestions' && <SuggestionsTab />}
        {tab === 'log' && <LogTab />}
      </main>
    </div>
  );
}
