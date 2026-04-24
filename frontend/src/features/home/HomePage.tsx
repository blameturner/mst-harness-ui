// frontend/src/features/home/HomePage.tsx
import { useState } from 'react';
import { useOverview } from './hooks/useOverview';
import { UnhealthyBanner } from './dashboard/UnhealthyBanner';
import { DashboardTab } from './tabs/DashboardTab';
import { LogsTab } from './tabs/LogsTab';
import { StatsTab } from './tabs/StatsTab';
import { QueueTab } from './tabs/QueueTab';

type Tab = 'dashboard' | 'logs' | 'stats' | 'queue';

const TABS: { id: Tab; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'logs', label: 'Logs' },
  { id: 'stats', label: 'Stats' },
  { id: 'queue', label: 'Queue' },
];

export function HomePage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const { overview, health, loading, refetch } = useOverview();

  const ok = health && health.scheduler_running;

  return (
    <div className="h-full flex flex-col bg-bg text-fg font-sans">
      <header className="shrink-0 border-b border-border px-4 sm:px-8 py-3 sm:py-4 flex items-center justify-between gap-3">
        <h1 className="font-display text-xl sm:text-2xl tracking-tightest">Home</h1>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <span
            className={`inline-block w-2 h-2 rounded-full ${
              ok ? 'bg-fg' : health ? 'bg-muted' : 'bg-border animate-blink'
            }`}
          />
          <span className="text-[10px] sm:text-[11px] uppercase tracking-[0.12em] sm:tracking-[0.14em] text-muted">
            {loading ? 'Checking' : ok ? 'All connected' : health ? 'Degraded' : 'Offline'}
          </span>
        </div>
      </header>

      <UnhealthyBanner health={health} />

      <nav className="shrink-0 border-b border-border px-2 sm:px-8 flex gap-0.5 sm:gap-1 overflow-x-auto no-scrollbar">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={[
              'px-3 sm:px-4 py-2.5 sm:py-3 text-[10px] sm:text-[11px] uppercase tracking-[0.14em] sm:tracking-[0.18em] font-sans border-b-2 -mb-px transition-colors whitespace-nowrap',
              tab === t.id ? 'border-fg text-fg' : 'border-transparent text-muted hover:text-fg',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {tab === 'dashboard' && <DashboardTab overview={overview} health={health} refetch={refetch} />}
        {tab === 'logs' && <LogsTab />}
        {tab === 'stats' && <StatsTab />}
        {tab === 'queue' && <QueueTab />}
      </div>
    </div>
  );
}
