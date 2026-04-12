import { useEffect, useState } from 'react';
import { health as fetchHealth } from '../../api/health/health';
import { EnrichmentContent } from '../enrichment/EnrichmentContent';
import { LogsPage } from '../logs/LogsPage';
import { ArchitectureTab } from './tabs/ArchitectureTab';
import { StatsTab } from './tabs/StatsTab';
import { QueueTab } from './tabs/QueueTab';
import type { HarnessTab } from './types/HarnessTab';
import type { HealthStatus } from './types/HealthStatus';

export function HarnessPage() {
  const [tab, setTab] = useState<HarnessTab>('architecture');
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHealth()
      .then((r) => setHealth(r))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const harnessOk = health?.harness === 'ok';

  const tabs: { id: HarnessTab; label: string }[] = [
    { id: 'architecture', label: 'Architecture' },
    { id: 'enrichment', label: 'Enrichment' },
    { id: 'logs', label: 'Logs' },
    { id: 'stats', label: 'Stats' },
    { id: 'queue', label: 'Queue' },
  ];

  return (
    <div className="h-full flex flex-col bg-bg text-fg font-sans">
      <header className="shrink-0 border-b border-border px-8 py-4 flex items-center justify-between">
        <h1 className="font-display text-2xl tracking-tightest">Harness</h1>
        <div className="flex items-center gap-3">
          <span
            className={`inline-block w-2 h-2 rounded-full ${harnessOk ? 'bg-fg' : health ? 'bg-muted' : 'bg-border animate-blink'}`}
          />
          <span className="text-[11px] uppercase tracking-[0.14em] text-muted">
            {loading
              ? 'Checking'
              : harnessOk
                ? 'All connected'
                : health
                  ? 'Harness unreachable'
                  : 'Gateway unreachable'}
          </span>
        </div>
      </header>

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

      <div className="flex-1 min-h-0 overflow-y-auto">
        {tab === 'architecture' && <ArchitectureTab />}
        {tab === 'enrichment' && <EnrichmentContent />}
        {tab === 'logs' && <LogsPage />}
        {tab === 'stats' && <StatsTab />}
        {tab === 'queue' && <QueueTab />}
      </div>
    </div>
  );
}
