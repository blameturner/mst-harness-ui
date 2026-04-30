import { useEffect, useState } from 'react';
import { harvestApi, type HarvestRun } from '../../api/harvest';
import { StatusPill, Eyebrow } from '../../components/ui';
import { relTime } from '../../lib/utils/relTime';

// Polls /harvest/active every 3s while any run is still in flight. Stops the
// timer when the list is empty so we don't churn requests on an idle page.
const POLL_MS = 3000;

export function LiveRail({
  onSelect,
  activeRunId,
}: {
  onSelect: (run: HarvestRun) => void;
  activeRunId: number | null;
}) {
  const [runs, setRuns] = useState<HarvestRun[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      harvestApi
        .active()
        .then((r) => {
          if (!cancelled) setRuns(r.runs);
        })
        .catch(() => {
          if (!cancelled) setRuns([]);
        });

    void load();
    const id = setInterval(() => {
      if (cancelled) return;
      // Constant 3s cadence — covers both 'pick up new in-flight runs' and
      // 'tick existing counters'. Cheap (one row-list query per tick) so
      // a backoff hasn't been worth the complexity.
      void load();
    }, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (runs == null) {
    return (
      <section className="px-5 sm:px-7 py-4 border-b border-border">
        <Eyebrow>Live</Eyebrow>
        <div className="text-xs text-muted mt-1">Loading…</div>
      </section>
    );
  }

  if (runs.length === 0) {
    return (
      <section className="px-5 sm:px-7 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Eyebrow>Live</Eyebrow>
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted">— nothing in flight</span>
        </div>
      </section>
    );
  }

  return (
    <section className="px-5 sm:px-7 py-4 border-b border-border">
      <div className="flex items-center gap-2 mb-3">
        <Eyebrow>Live</Eyebrow>
        <span className="text-[10px] uppercase tracking-[0.18em] text-muted">
          {runs.length} in flight
        </span>
      </div>
      <ul className="space-y-1.5">
        {runs.map((r) => (
          <LiveRow
            key={r.Id}
            run={r}
            active={activeRunId === r.Id}
            onClick={() => onSelect(r)}
          />
        ))}
      </ul>
    </section>
  );
}

function LiveRow({
  run,
  active,
  onClick,
}: {
  run: HarvestRun;
  active: boolean;
  onClick: () => void;
}) {
  const planned = run.urls_planned || 0;
  const fetched = run.urls_fetched || 0;
  const persisted = run.urls_persisted || 0;
  const failed = run.urls_failed || 0;
  // Progress proxies: prefer fetched/planned (the runner writes both), fall
  // back to persisted/planned for older rows that don't have a fetched value.
  const denom = planned || fetched || 1;
  const numer = Math.max(fetched, persisted);
  const pct = Math.min(100, Math.round((numer / denom) * 100));

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={[
          'w-full text-left rounded-sm border px-3 py-2 transition-colors',
          active ? 'border-fg bg-panelHi' : 'border-border hover:bg-panel',
        ].join(' ')}
      >
        <div className="flex items-center gap-3">
          <StatusPill status={run.status} />
          <span className="font-mono text-[11px] text-fg">{run.policy}</span>
          <span className="text-xs text-muted truncate flex-1" title={run.seed}>
            {run.seed}
          </span>
          <span className="text-xs font-mono text-muted whitespace-nowrap">
            {fetched}
            <span className="text-muted/60">/{planned || '?'}</span>
            {failed > 0 && <span className="text-red-700 ml-2">·{failed} failed</span>}
          </span>
          <span className="text-[10px] uppercase tracking-[0.16em] text-muted whitespace-nowrap">
            {run.started_at ? relTime(run.started_at) : 'queued'}
          </span>
        </div>
        <div className="mt-1.5 h-0.5 bg-border rounded-sm overflow-hidden">
          <div
            className="h-full bg-fg transition-[width] duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </button>
    </li>
  );
}
