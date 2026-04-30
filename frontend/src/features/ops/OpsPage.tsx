import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  opsPageApi,
  type OpsConnector,
  type OpsConnectorCall,
  type OpsResearchArtifact,
  type OpsResearchArtifactDetail,
  type OpsScheduledJob,
  type OpsScheduledJobHistoryRow,
} from '../../api/ops/page';
import {
  Btn,
  Drawer,
  Empty,
  Eyebrow,
  PageHeader,
  StatusPill,
  TabRow,
  type TabDef,
} from '../../components/ui';
import { relTime } from '../../lib/utils/relTime';
import { ControlPlaneTab } from './ControlPlaneTab';
import { LogsPage } from '../logs/LogsPage';
import { StatsTab } from '../home/tabs/StatsTab';
import { ConnectorsPage } from '../connectors/ConnectorsPage';

type Tab =
  | 'control'
  | 'logs'
  | 'stats'
  | 'integrations'
  | 'activity'
  | 'scheduler'
  | 'research';
const TABS: ReadonlyArray<TabDef<Tab>> = [
  { id: 'control', label: 'Control plane' },
  { id: 'logs', label: 'Logs' },
  { id: 'stats', label: 'Stats' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'activity', label: 'Connector activity' },
  { id: 'scheduler', label: 'Scheduler' },
  { id: 'research', label: 'Research artifacts' },
];

export function OpsPage() {
  const [tab, setTab] = useState<Tab>('control');

  return (
    <div className="h-full flex flex-col bg-bg text-fg font-sans">
      <PageHeader
        eyebrow="Operations"
        title="Ops"
        right={<TabRow tabs={TABS} active={tab} onChange={setTab} size="sm" />}
      />

      <div className="flex-1 min-h-0 overflow-y-auto">
        {tab === 'control' && <ControlPlaneTab />}
        {tab === 'logs' && <LogsPage />}
        {tab === 'stats' && <StatsTab />}
        {tab === 'integrations' && <ConnectorsPage />}
        {tab === 'activity' && <ConnectorsTab />}
        {tab === 'scheduler' && <SchedulerTab />}
        {tab === 'research' && <ResearchTab />}
      </div>
    </div>
  );
}

function ConnectorsTab() {
  const [conns, setConns] = useState<OpsConnector[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [calls, setCalls] = useState<Record<string, OpsConnectorCall[] | null>>({});
  const [testing, setTesting] = useState<string | null>(null);

  useEffect(() => {
    opsPageApi.connectors().then((r) => setConns(r.connectors)).catch(() => setConns([]));
  }, []);

  const expand = async (id: string) => {
    setOpen(open === id ? null : id);
    if (calls[id]) return;
    try {
      const r = await opsPageApi.connectorCalls(id, 50);
      setCalls((m) => ({ ...m, [id]: r.calls }));
    } catch {
      setCalls((m) => ({ ...m, [id]: [] }));
    }
  };

  const test = async (id: string) => {
    setTesting(id);
    try {
      await opsPageApi.connectorTest(id);
    } finally {
      setTesting(null);
    }
  };

  return (
    <div className="px-5 sm:px-8 py-5">
      {conns == null ? (
        <div className="text-xs text-muted">Loading…</div>
      ) : conns.length === 0 ? (
        <Empty title="no connectors registered" />
      ) : (
        <div className="overflow-x-auto border border-border rounded-md">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.18em] text-muted border-b border-border bg-panel/40">
                <th className="text-left py-2 px-3">name</th>
                <th className="text-left py-2 px-3 w-24">kind</th>
                <th className="text-left py-2 px-3 w-28">status</th>
                <th className="text-right py-2 px-3 w-32">last call</th>
                <th className="text-right py-2 px-3 w-24">errors 24h</th>
                <th className="text-right py-2 px-3 w-28">actions</th>
              </tr>
            </thead>
            <tbody>
              {conns.map((c) => (
                <Fragment key={c.id}>
                  <tr
                    onClick={() => void expand(c.id)}
                    className={[
                      'border-b border-border cursor-pointer transition-colors',
                      open === c.id ? 'bg-panelHi' : 'hover:bg-panel/60',
                    ].join(' ')}
                  >
                    <td className="py-2 px-3 text-fg">{c.name}</td>
                    <td className="py-2 px-3 text-xs font-mono text-muted">{c.kind}</td>
                    <td className="py-2 px-3">
                      <StatusPill status={c.status} />
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-xs text-muted">
                      {c.last_call_at ? relTime(c.last_call_at) : '—'}
                    </td>
                    <td
                      className={`py-2 px-3 text-right font-mono text-xs ${
                        c.error_count_24h ? 'text-red-700' : 'text-muted'
                      }`}
                    >
                      {c.error_count_24h ?? 0}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <Btn
                        size="sm"
                        disabled={testing === c.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          void test(c.id);
                        }}
                      >
                        {testing === c.id ? 'Testing…' : 'Test'}
                      </Btn>
                    </td>
                  </tr>
                  {open === c.id && (
                    <tr className="border-b border-border bg-panel/30">
                      <td colSpan={6} className="px-3 py-3">
                        <CallsTable rows={calls[c.id] ?? null} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CallsTable({ rows }: { rows: OpsConnectorCall[] | null }) {
  if (rows == null) return <div className="text-xs text-muted">Loading…</div>;
  if (rows.length === 0) return <div className="text-[11px] uppercase tracking-[0.18em] text-muted">no recent calls</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-[9px] uppercase tracking-[0.16em] text-muted border-b border-border">
            <th className="text-left py-1.5 w-24">time</th>
            <th className="text-left py-1.5">endpoint</th>
            <th className="text-right py-1.5 w-20">ms</th>
            <th className="text-right py-1.5 w-16">code</th>
            <th className="text-left py-1.5 w-1/3">error</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-border/60 last:border-b-0">
              <td className="py-1 text-muted">{relTime(r.ts)}</td>
              <td className="py-1 font-mono truncate max-w-[280px]">{r.endpoint}</td>
              <td className="py-1 text-right font-mono">{r.duration_ms}</td>
              <td
                className={`py-1 text-right font-mono ${
                  r.ok ? 'text-muted' : 'text-red-700'
                }`}
              >
                {r.status_code ?? '—'}
              </td>
              <td className="py-1 text-red-700 truncate">{r.error || ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SchedulerTab() {
  const [jobs, setJobs] = useState<OpsScheduledJob[] | null>(null);
  const [active, setActive] = useState<OpsScheduledJob | null>(null);
  const [history, setHistory] = useState<OpsScheduledJobHistoryRow[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    opsPageApi.scheduledJobs().then((r) => setJobs(r.jobs)).catch(() => setJobs([]));
  }, []);

  const openJob = async (j: OpsScheduledJob) => {
    setActive(j);
    setHistory(null);
    try {
      const r = await opsPageApi.scheduledJobHistory(j.id, 50);
      setHistory(r.runs);
    } catch {
      setHistory([]);
    }
  };

  const runNow = async () => {
    if (!active) return;
    setBusy(true);
    try {
      await opsPageApi.scheduledJobRunNow(active.id);
    } finally {
      setBusy(false);
    }
  };
  const togglePause = async () => {
    if (!active) return;
    setBusy(true);
    try {
      if (active.paused) await opsPageApi.scheduledJobResume(active.id);
      else await opsPageApi.scheduledJobPause(active.id);
      setActive({ ...active, paused: !active.paused });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="px-5 sm:px-8 py-5">
      <WeeklyGrid jobs={jobs} onPick={(j) => void openJob(j)} />
      <Drawer
        open={!!active}
        onClose={() => setActive(null)}
        eyebrow="Scheduled job"
        title={active?.name}
        meta={active?.cron}
        actions={
          active && (
            <>
              <Btn variant="primary" onClick={() => void runNow()} disabled={busy}>
                Run now
              </Btn>
              <Btn onClick={() => void togglePause()} disabled={busy}>
                {active.paused ? 'Resume' : 'Pause'}
              </Btn>
            </>
          )
        }
      >
        {active && (
          <>
            <dl className="grid grid-cols-[7rem_1fr] gap-y-1.5 text-xs">
              {active.next_fire_at && (
                <>
                  <dt className="text-muted">next fire</dt>
                  <dd className="font-mono">{relTime(active.next_fire_at)}</dd>
                </>
              )}
              {active.last_run_at && (
                <>
                  <dt className="text-muted">last run</dt>
                  <dd className="font-mono">{relTime(active.last_run_at)}</dd>
                </>
              )}
              <dt className="text-muted">state</dt>
              <dd>
                <StatusPill
                  status={active.paused ? 'cancelled' : 'running'}
                  tone={active.paused ? 'neutral' : 'success'}
                >
                  {active.paused ? 'paused' : 'active'}
                </StatusPill>
              </dd>
            </dl>

            <div className="mt-5">
              <Eyebrow className="mb-2">History</Eyebrow>
              {history == null ? (
                <div className="text-xs text-muted">Loading…</div>
              ) : history.length === 0 ? (
                <Empty compact />
              ) : (
                <ul className="space-y-1.5">
                  {history.map((h) => (
                    <li
                      key={h.id}
                      className="flex items-baseline gap-2 text-xs border-b border-border/70 pb-1.5 last:border-b-0"
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          h.ok ? 'bg-emerald-500' : 'bg-red-500'
                        }`}
                      />
                      <span className="text-muted font-mono w-20 shrink-0">
                        {relTime(h.ts)}
                      </span>
                      {h.duration_ms != null && (
                        <span className="text-muted font-mono">{h.duration_ms}ms</span>
                      )}
                      <span className="truncate text-fg/85">{h.message || ''}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </Drawer>
    </div>
  );
}

function WeeklyGrid({
  jobs,
  onPick,
}: {
  jobs: OpsScheduledJob[] | null;
  onPick: (j: OpsScheduledJob) => void;
}) {
  const buckets = useMemo(() => {
    const days: OpsScheduledJob[][][] = Array.from({ length: 7 }, () =>
      Array.from({ length: 24 }, () => []),
    );
    if (!jobs) return days;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    for (const j of jobs) {
      if (!j.next_fire_at) continue;
      const t = new Date(j.next_fire_at);
      const dayOffset = Math.floor((t.getTime() - startOfToday.getTime()) / 86_400_000);
      if (dayOffset < 0 || dayOffset > 6) continue;
      days[dayOffset][t.getHours()].push(j);
    }
    return days;
  }, [jobs]);

  if (jobs == null) return <div className="text-xs text-muted">Loading…</div>;
  if (jobs.length === 0)
    return (
      <Empty
        title="No scheduled jobs"
        hint="Jobs added from the Schedules feature will appear in this week's grid."
      />
    );

  const dayLabels = ['Today', '+1', '+2', '+3', '+4', '+5', '+6'];
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <Eyebrow>Next 7 days · grouped by hour</Eyebrow>
        <span className="text-[10px] uppercase tracking-[0.18em] text-muted">
          {jobs.length} job{jobs.length === 1 ? '' : 's'}
        </span>
      </div>
      <div className="grid grid-cols-[5rem_repeat(7,minmax(0,1fr))] gap-px bg-border border border-border rounded-md overflow-hidden">
        <div className="bg-panel" />
        {dayLabels.map((d) => (
          <div
            key={d}
            className="bg-panel text-center py-1.5 text-[10px] uppercase tracking-[0.18em] text-muted"
          >
            {d}
          </div>
        ))}
        {Array.from({ length: 24 }).map((_, h) => (
          <Fragment key={h}>
            <div className="bg-panel text-right pr-2 py-1 text-[10px] font-mono text-muted">
              {String(h).padStart(2, '0')}:00
            </div>
            {buckets.map((day, di) => (
              <div key={`${h}-${di}`} className="bg-bg min-h-[28px] p-1 space-y-0.5">
                {day[h].map((j) => (
                  <button
                    key={j.id}
                    onClick={() => onPick(j)}
                    title={j.name}
                    className={[
                      'block w-full truncate text-[10px] px-1.5 py-0.5 border rounded-sm text-left transition-colors',
                      j.paused
                        ? 'border-border text-muted bg-panel/40'
                        : 'border-fg bg-fg text-bg hover:bg-fg/85',
                    ].join(' ')}
                  >
                    {j.name}
                  </button>
                ))}
              </div>
            ))}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function ResearchTab() {
  const [arts, setArts] = useState<OpsResearchArtifact[] | null>(null);
  const [active, setActive] = useState<OpsResearchArtifactDetail | null>(null);

  useEffect(() => {
    opsPageApi.researchArtifacts(200).then((r) => setArts(r.artifacts)).catch(() => setArts([]));
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, { plan_title?: string; items: OpsResearchArtifact[] }>();
    for (const a of arts ?? []) {
      const cur = map.get(a.plan_id) ?? { plan_title: a.plan_title, items: [] };
      cur.items.push(a);
      map.set(a.plan_id, cur);
    }
    return [...map.entries()];
  }, [arts]);

  return (
    <div className="px-5 sm:px-8 py-5">
      {arts == null ? (
        <div className="text-xs text-muted">Loading…</div>
      ) : arts.length === 0 ? (
        <Empty title="no artifacts" />
      ) : (
        <div className="space-y-8">
          {grouped.map(([planId, { plan_title, items }]) => (
            <section key={planId}>
              <div className="flex items-baseline justify-between mb-2 gap-3">
                <h2 className="font-display text-xl tracking-tightest leading-tight">
                  {plan_title || planId}
                </h2>
                <Eyebrow>{items.length} artifacts</Eyebrow>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {items.map((a) => (
                  <button
                    key={a.id}
                    onClick={() =>
                      void opsPageApi.researchArtifact(a.id).then(setActive)
                    }
                    className="text-left border border-border rounded-md bg-bg p-3 hover:border-fg hover:shadow-card transition-all"
                  >
                    <Eyebrow>{a.kind || 'artifact'}</Eyebrow>
                    <div className="font-display text-sm tracking-tightest leading-tight mt-1 line-clamp-2">
                      {a.title}
                    </div>
                    {a.summary && (
                      <p className="text-xs text-muted mt-1 line-clamp-2">{a.summary}</p>
                    )}
                    <div className="text-[10px] text-muted mt-2 font-mono">
                      {relTime(a.created_at)}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <Drawer
        open={!!active}
        onClose={() => setActive(null)}
        width="max-w-2xl"
        eyebrow={active?.kind || 'artifact'}
        title={active?.title}
        meta={active?.created_at ? relTime(active.created_at) : undefined}
      >
        {active?.body && (
          <div className="text-sm whitespace-pre-wrap leading-relaxed text-fg/90">
            {active.body}
          </div>
        )}
        {active?.url && (
          <a
            href={active.url}
            target="_blank"
            rel="noreferrer"
            className="inline-block mt-4 text-[11px] uppercase tracking-[0.18em] underline hover:no-underline"
          >
            {active.url}
          </a>
        )}
        {active?.citations && active.citations.length > 0 && (
          <div className="mt-6 border-t border-border pt-4">
            <Eyebrow className="mb-2">Citations</Eyebrow>
            <ol className="text-xs space-y-1.5 list-decimal pl-5 text-fg/85">
              {active.citations.map((c) => (
                <li key={c.id}>
                  {c.url ? (
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noreferrer"
                      className="underline hover:no-underline"
                    >
                      {c.title || c.url}
                    </a>
                  ) : (
                    c.title || c.id
                  )}
                </li>
              ))}
            </ol>
          </div>
        )}
      </Drawer>
    </div>
  );
}
