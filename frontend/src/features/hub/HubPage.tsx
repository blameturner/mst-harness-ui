import { useEffect, useState } from 'react';
import { health as fetchHealth } from '../../api/health/health';
import { LogsPage } from '../logs/LogsPage';
import { StatsTab } from './tabs/StatsTab';
import { QueueTab } from './tabs/QueueTab';
import { ResearchTab } from './tabs/ResearchTab';
import { HomeTab } from './tabs/HomeTab';
import type { HubTab } from './types/HubTab';
import type { HealthStatus } from './types/HealthStatus';

export function HubPage() {
  const [tab, setTab] = useState<HubTab>('home');
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHealth()
      .then((r) => setHealth(r))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const hubOk = health?.harness === 'ok';

  const tabs: { id: HubTab; label: string }[] = [
    { id: 'home', label: 'Home' },
    { id: 'logs', label: 'Logs' },
    { id: 'stats', label: 'Stats' },
    { id: 'queue', label: 'Queue Center' },
    { id: 'research', label: 'Research' },
  ];

  return (
    <div className="h-full flex flex-col bg-bg text-fg font-sans">
      <header className="shrink-0 border-b border-border px-8 py-4 flex items-center justify-between">
        <h1 className="font-display text-2xl tracking-tightest">Hub</h1>
        <div className="flex items-center gap-3">
          <span
            className={`inline-block w-2 h-2 rounded-full ${hubOk ? 'bg-fg' : health ? 'bg-muted' : 'bg-border animate-blink'}`}
          />
          <span className="text-[11px] uppercase tracking-[0.14em] text-muted">
            {loading
              ? 'Checking'
              : hubOk
                ? 'All connected'
                : health
                  ? 'Hub unreachable'
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
        {tab === 'home' && <HomeTab />}
        {tab === 'logs' && <LogsPage />}
        {tab === 'stats' && <StatsTab />}
        {tab === 'queue' && <QueueTab />}
        {tab === 'research' && <ResearchTab />}
      </div>
    </div>
  );
}