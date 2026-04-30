import { useOverview } from './hooks/useOverview';
import { UnhealthyBanner } from './dashboard/UnhealthyBanner';
import { DashboardTab } from './tabs/DashboardTab';

export function HomePage() {
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

      <div className="flex-1 min-h-0 overflow-y-auto">
        <DashboardTab overview={overview} health={health} refetch={refetch} />
      </div>
    </div>
  );
}
