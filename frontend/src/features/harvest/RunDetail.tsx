import { useEffect, useMemo, useState } from 'react';
import {
  harvestApi,
  isTerminal,
  type HarvestArtifactsResponse,
  type HarvestPolicy,
  type HarvestRun,
} from '../../api/harvest';
import { Btn, Empty, Eyebrow, StatusPill } from '../../components/ui';
import { PersistTargetChip } from './TriggerForm';
import { relTime } from '../../lib/utils/relTime';

export function RunDetail({
  runId,
  fallback,
  policies,
  onChanged,
  onOpenParent,
}: {
  runId: number | null;
  fallback: HarvestRun | null;
  policies: HarvestPolicy[] | null;
  onChanged: () => void;
  onOpenParent: (id: number) => void;
}) {
  const [run, setRun] = useState<HarvestRun | null>(fallback);
  const [artifacts, setArtifacts] = useState<HarvestArtifactsResponse | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!runId) {
      setRun(null);
      setArtifacts(null);
      return;
    }
    let cancelled = false;
    const fetchOne = () =>
      harvestApi
        .getRun(runId)
        .then((r) => {
          if (!cancelled) setRun(r.run);
        })
        .catch(() => undefined);

    void fetchOne();
    const id = setInterval(() => {
      if (run && isTerminal(run.status)) return;
      void fetchOne();
    }, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, run?.status]);

  const policy = useMemo(
    () => policies?.find((p) => p.name === run?.policy) ?? null,
    [policies, run?.policy],
  );

  useEffect(() => {
    if (!runId || !run) return;
    if (policy?.persist_target !== 'artifacts') {
      setArtifacts(null);
      return;
    }
    if (!isTerminal(run.status)) return;
    harvestApi.getArtifacts(runId).then(setArtifacts).catch(() => setArtifacts(null));
  }, [runId, run?.status, policy?.persist_target]);

  if (!runId || !run) {
    return (
      <aside className="hidden md:flex flex-col items-center justify-center text-center px-6 py-10 bg-panel/30">
        <div className="font-display text-base text-fg">No run selected</div>
        <p className="text-xs text-muted mt-1 max-w-[14rem]">
          Trigger a policy or pick a row from the runs list to inspect counters and artifacts.
        </p>
      </aside>
    );
  }

  const cancel = async () => {
    setBusy('cancel');
    try {
      await harvestApi.cancelRun(run.Id);
      setRun({ ...run, status: 'cancelled' });
      onChanged();
    } finally {
      setBusy(null);
    }
  };
  const retry = async () => {
    setBusy('retry');
    try {
      await harvestApi.retryRun(run.Id);
      onChanged();
    } finally {
      setBusy(null);
    }
  };

  const inFlight = !isTerminal(run.status);

  return (
    <aside className="flex flex-col min-h-0 overflow-hidden bg-panel/30">
      <header className="shrink-0 sticky top-0 bg-bg/95 backdrop-blur-sm border-b border-border px-5 py-4 z-10">
        <div className="flex items-center gap-2 flex-wrap">
          <StatusPill status={run.status} />
          <span className="font-mono text-[11px] text-fg">{run.policy}</span>
          {policy && <PersistTargetChip target={policy.persist_target} />}
        </div>
        <div
          className="mt-2 text-xs text-fg/85 truncate font-mono"
          title={run.seed}
        >
          {run.seed}
        </div>
        <div className="mt-1 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted">
          <span>run · #{run.Id}</span>
          <span aria-hidden>·</span>
          <span>created {relTime(run.CreatedAt)}</span>
          {inFlight && (
            <span className="ml-auto inline-flex items-center gap-1 text-sky-700">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-blink" />
              live
            </span>
          )}
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5 space-y-6">
        <CountersStrip run={run} />

        <Timeline run={run} />

        {run.error_message && (
          <div className="border border-red-200 bg-red-50 rounded-md p-3 text-xs text-red-800 whitespace-pre-wrap">
            <div className="text-[10px] uppercase tracking-[0.18em] text-red-700 mb-1">error</div>
            {run.error_message}
          </div>
        )}

        {run.status === 'completed' && run.urls_failed > 0 && (
          <div className="border border-amber-200 bg-amber-50 rounded-md p-3 text-xs text-amber-900">
            {run.urls_failed} URL{run.urls_failed === 1 ? '' : 's'} failed during this run.
          </div>
        )}
        {run.status === 'completed' && run.urls_unchanged > 0 && (
          <div className="border border-border bg-panel/60 rounded-md p-3 text-xs text-muted">
            {run.urls_unchanged} pages unchanged since last run (cheap re-check).
          </div>
        )}

        {run.status === 'queued' && (
          <div className="text-xs text-muted">queued — waiting for worker.</div>
        )}
        {run.status === 'cancelled' && (
          <div className="text-xs text-muted">Cancelled by user.</div>
        )}

        <UrlEventLog runId={run.Id} inFlight={inFlight} />

        <ArtifactsSection run={run} policy={policy} artifacts={artifacts} />
      </div>

      <footer className="shrink-0 border-t border-border bg-bg px-5 py-3 flex flex-wrap gap-2">
        {inFlight && (
          <Btn variant="danger" onClick={() => void cancel()} disabled={busy === 'cancel'}>
            {busy === 'cancel' ? 'Cancelling…' : 'Cancel'}
          </Btn>
        )}
        <Btn variant="primary" onClick={() => void retry()} disabled={busy === 'retry'}>
          {busy === 'retry' ? 'Retrying…' : 'Retry'}
        </Btn>
        {run.parent_run_id != null && (
          <Btn variant="ghost" size="sm" onClick={() => onOpenParent(run.parent_run_id!)}>
            ↑ parent #{run.parent_run_id}
          </Btn>
        )}
      </footer>
    </aside>
  );
}

function CountersStrip({ run }: { run: HarvestRun }) {
  const items: Array<{
    label: string;
    value: number;
    tone: string;
    help: string;
    big?: boolean;
  }> = [
    {
      label: 'persisted',
      value: run.urls_persisted,
      tone: 'text-emerald-800',
      help: 'New rows or chunks written to the persist target.',
      big: true,
    },
    { label: 'unchanged', value: run.urls_unchanged, tone: 'text-fg', help: '304 Not Modified — server confirmed nothing changed.' },
    { label: 'skipped', value: run.urls_skipped, tone: 'text-muted', help: 'Skipped by robots, rate limit, or cool-off.' },
    { label: 'failed', value: run.urls_failed, tone: 'text-red-700', help: 'Fetch or extraction errors.' },
    { label: 'fetched', value: run.urls_fetched, tone: 'text-fg/80', help: 'Total fetches attempted (may include retries).' },
  ];
  const headline = items[0];
  const rest = items.slice(1);
  return (
    <section>
      <Eyebrow className="mb-2">Counters</Eyebrow>
      <div className="grid grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,1fr))] gap-2">
        <div
          title={headline.help}
          className="border border-border rounded-md bg-bg p-3 flex flex-col justify-between min-h-[5.5rem]"
        >
          <Eyebrow>{headline.label}</Eyebrow>
          <div className={`font-display text-4xl tracking-tightest leading-none ${headline.tone}`}>
            {headline.value}
          </div>
        </div>
        {rest.map((it) => (
          <div
            key={it.label}
            title={it.help}
            className="border border-border rounded-md bg-bg p-2 flex flex-col justify-between min-h-[5.5rem]"
          >
            <Eyebrow>{it.label}</Eyebrow>
            <div className={`font-mono text-xl ${it.tone}`}>{it.value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Timeline({ run }: { run: HarvestRun }) {
  const startMs = run.started_at ? new Date(run.started_at).getTime() : null;
  const endMs = run.finished_at
    ? new Date(run.finished_at).getTime()
    : !isTerminal(run.status) && startMs
    ? Date.now()
    : null;
  const elapsed = startMs && endMs ? endMs - startMs : null;
  const inFlight = !isTerminal(run.status);

  return (
    <section className="text-xs">
      <Eyebrow className="mb-2">Timeline</Eyebrow>
      <dl className="grid grid-cols-[6rem_1fr] gap-y-1.5">
        <dt className="text-muted">started</dt>
        <dd className="font-mono">{run.started_at ?? '—'}</dd>
        <dt className="text-muted">finished</dt>
        <dd className="font-mono">{run.finished_at ?? '—'}</dd>
        <dt className="text-muted">elapsed</dt>
        <dd className="font-mono">
          {elapsed != null ? fmtElapsed(elapsed) : '—'}
          {inFlight && startMs && (
            <span className="ml-2 text-sky-700 inline-flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-blink" />
              running for {fmtElapsed(Date.now() - startMs)}
            </span>
          )}
        </dd>
        <dt className="text-muted">cost</dt>
        <dd className="font-mono">${run.cost_usd.toFixed(4)}</dd>
      </dl>
    </section>
  );
}

// Per-URL event tail — populated from the runner's rolling buffer in
// artifacts_json["events"]. Polls while the run is in flight; loads once
// after it terminates.
function UrlEventLog({ runId, inFlight }: { runId: number; inFlight: boolean }) {
  const [events, setEvents] = useState<Array<{
    ts: string;
    url: string;
    outcome: string;
    depth: number;
  }> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      harvestApi
        .runLog(runId, 200)
        .then((r) => {
          if (!cancelled) setEvents(r.events);
        })
        .catch(() => undefined);

    void load();
    if (!inFlight) return () => { cancelled = true; };
    const id = setInterval(load, 4000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [runId, inFlight]);

  if (events == null) {
    return (
      <section>
        <Eyebrow className="mb-2">Log</Eyebrow>
        <div className="text-xs text-muted">loading…</div>
      </section>
    );
  }
  if (events.length === 0) {
    return (
      <section>
        <Eyebrow className="mb-2">Log</Eyebrow>
        <div className="text-xs text-muted">No URL events recorded yet.</div>
      </section>
    );
  }
  // Newest first reads better in a drawer.
  const reversed = [...events].reverse();
  return (
    <section>
      <div className="flex items-center gap-2 mb-2">
        <Eyebrow>Log</Eyebrow>
        <span className="text-[10px] uppercase tracking-[0.18em] text-muted">
          {events.length} event{events.length === 1 ? '' : 's'}
        </span>
      </div>
      <ul className="border border-border rounded-md bg-bg divide-y divide-border max-h-72 overflow-y-auto">
        {reversed.map((e, i) => (
          <li key={`${e.ts}-${i}`} className="px-2.5 py-1.5 text-[11px] flex items-center gap-2">
            <OutcomePill outcome={e.outcome} />
            <span className="font-mono text-fg/85 truncate flex-1" title={e.url}>
              {e.url}
            </span>
            <span className="text-muted text-[10px] tabular-nums whitespace-nowrap">
              d{e.depth}
            </span>
            <span className="text-muted text-[10px] tabular-nums whitespace-nowrap">
              {e.ts.slice(11, 19)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function OutcomePill({ outcome }: { outcome: string }) {
  // Map runner outcomes to the established status palette without inventing
  // new colour tokens. persisted=success, unchanged=neutral, skipped=muted,
  // anything else=failure.
  const tone = outcome === 'persisted'
    ? 'border-emerald-300 text-emerald-800 bg-emerald-50'
    : outcome === 'unchanged'
    ? 'border-border text-fg bg-panel'
    : outcome === 'skipped'
    ? 'border-border text-muted bg-panel'
    : 'border-red-300 text-red-700 bg-red-50';
  return (
    <span
      className={`px-1.5 py-px font-mono text-[9px] uppercase tracking-[0.16em] border rounded-sm whitespace-nowrap ${tone}`}
    >
      {outcome}
    </span>
  );
}

function fmtElapsed(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
  return `${(ms / 3_600_000).toFixed(2)}h`;
}

function ArtifactsSection({
  run,
  policy,
  artifacts,
}: {
  run: HarvestRun;
  policy: HarvestPolicy | null;
  artifacts: HarvestArtifactsResponse | null;
}) {
  const target = policy?.persist_target;

  if (target === 'knowledge') {
    return (
      <section>
        <Eyebrow className="mb-2">Knowledge</Eyebrow>
        <p className="text-sm">
          Wrote <span className="font-mono">{run.urls_persisted}</span> entries to the RAG corpus.
        </p>
        <a
          href={`/knowledge?harvest_run_id=${run.Id}`}
          className="inline-block mt-2 text-[11px] uppercase tracking-[0.18em] underline hover:no-underline"
        >
          View in knowledge browser →
        </a>
      </section>
    );
  }

  if (target !== 'artifacts') {
    return (
      <section>
        <Eyebrow className="mb-2">Persisted to</Eyebrow>
        <p className="text-xs text-muted">
          this policy persists to <span className="font-mono text-fg">{target ?? 'unknown'}</span>
        </p>
      </section>
    );
  }

  if (!artifacts) {
    return (
      <section>
        <Eyebrow className="mb-2">Artifacts</Eyebrow>
        <Empty
          compact
          title={isTerminal(run.status) ? 'loading artifacts…' : 'available after run completes'}
        />
      </section>
    );
  }

  const policyArtifacts = artifacts.artifacts[run.policy];
  const items = policyArtifacts?.items ?? [];
  if (items.length === 0) {
    return (
      <section>
        <Eyebrow className="mb-2">Artifacts</Eyebrow>
        <Empty compact />
      </section>
    );
  }

  const columns = Object.keys(items[0]);

  const exportCsv = () => {
    const head = columns.join(',');
    const body = items
      .map((row) =>
        columns
          .map((c) => {
            const v = row[c];
            const s = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
            return `"${s.replace(/"/g, '""')}"`;
          })
          .join(','),
      )
      .join('\n');
    const blob = new Blob([head + '\n' + body], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `harvest-${run.Id}-${run.policy}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <Eyebrow>Artifacts · {items.length}</Eyebrow>
        <Btn variant="ghost" size="sm" onClick={exportCsv}>
          Export CSV
        </Btn>
      </div>
      <div className="overflow-x-auto border border-border rounded-md bg-bg">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="text-[9px] uppercase tracking-[0.16em] text-muted border-b border-border bg-panel/40">
              {columns.map((c) => (
                <th key={c} className="text-left px-2 py-1.5">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.slice(0, 200).map((row, i) => (
              <tr key={i} className="border-b border-border/60 last:border-b-0">
                {columns.map((c) => (
                  <td key={c} className="px-2 py-1 align-top max-w-[20rem]">
                    <div className="truncate" title={fmtCell(row[c])}>
                      {fmtCell(row[c])}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {items.length > 200 && (
          <div className="px-2 py-1 text-[10px] text-muted bg-panel/40">
            showing first 200 of {items.length} — export for full set
          </div>
        )}
      </div>
    </section>
  );
}

function fmtCell(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}
