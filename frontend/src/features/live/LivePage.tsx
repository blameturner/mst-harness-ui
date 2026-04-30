import { useEffect, useRef, useState } from 'react';
import {
  liveApi,
  liveEventStreamUrl,
  liveJobLogStreamUrl,
  type EnrichmentSuggestion,
  type ToolJob,
  type ToolJobDeps,
  type TriggerKind,
  type TriggerStatus,
} from '../../api/live';
import { Btn, Empty, Eyebrow, PageHeader, StatusPill } from '../../components/ui';
import { relTime } from '../../lib/utils/relTime';

const TRIGGER_KINDS: TriggerKind[] = ['insights', 'digest', 'seed_feedback', 'pa'];

export function LivePage() {
  const [toasts, setToasts] = useState<Array<{ id: string; text: string; ts: number }>>([]);

  useEffect(() => {
    const url = liveEventStreamUrl();
    const es = new EventSource(url, { withCredentials: true });
    es.onmessage = (e) => {
      try {
        const ev = JSON.parse(e.data);
        const text =
          typeof ev === 'string'
            ? ev
            : ev.message || `${ev.type ?? 'event'}${ev.kind ? ` · ${ev.kind}` : ''}`;
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        setToasts((t) => [...t.slice(-4), { id, text, ts: Date.now() }]);
        setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000);
      } catch {
        /* ignore */
      }
    };
    return () => es.close();
  }, []);

  return (
    <div className="h-full flex flex-col bg-bg text-fg font-sans">
      <PageHeader
        eyebrow="Realtime console"
        title="Live"
        right={
          <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.22em] text-muted">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-blink" />
            stream open
          </span>
        }
      />

      {toasts.length > 0 && (
        <div className="shrink-0 border-b border-border bg-panel/60 px-5 sm:px-8 py-1.5 flex items-center gap-2 overflow-x-auto no-scrollbar">
          {toasts.map((t) => (
            <span
              key={t.id}
              className="shrink-0 text-[10px] uppercase tracking-[0.18em] text-fg border border-border bg-bg px-2 py-1 rounded-sm animate-fadeIn"
            >
              {t.text}
            </span>
          ))}
        </div>
      )}

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-border overflow-hidden">
        <JobsColumn />
        <SuggestionsColumn />
        <TriggersColumn />
      </div>
    </div>
  );
}

function ColumnHeader({
  eyebrow,
  title,
  right,
}: {
  eyebrow: string;
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="shrink-0 px-4 py-3 border-b border-border flex items-end justify-between gap-2">
      <div>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2 className="font-display text-base tracking-tightest leading-none mt-0.5">{title}</h2>
      </div>
      {right && <div className="shrink-0 flex items-center gap-2">{right}</div>}
    </div>
  );
}

// ── Jobs column ───────────────────────────────────────────────────────────

function JobsColumn() {
  const [jobs, setJobs] = useState<ToolJob[] | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [active, setActive] = useState<ToolJob | null>(null);

  const load = () =>
    liveApi
      .jobs({ status: statusFilter || undefined, limit: 100 })
      .then((r) => setJobs(r.jobs))
      .catch(() => setJobs([]));
  useEffect(() => {
    void load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  return (
    <section className="flex flex-col min-h-0 overflow-hidden">
      <ColumnHeader
        eyebrow="Tool queue"
        title="Jobs"
        right={
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-bg border border-border rounded-sm text-[10px] uppercase tracking-[0.16em] px-1.5 py-0.5 focus:outline-none focus:border-fg"
          >
            <option value="">all</option>
            <option value="queued">queued</option>
            <option value="running">running</option>
            <option value="completed">completed</option>
            <option value="failed">failed</option>
            <option value="cancelled">cancelled</option>
          </select>
        }
      />
      <div className="flex-1 min-h-0 overflow-y-auto">
        {jobs == null ? (
          <div className="px-4 py-3 text-xs text-muted">Loading…</div>
        ) : jobs.length === 0 ? (
          <div className="px-4 py-3">
            <Empty compact />
          </div>
        ) : (
          <ul>
            {jobs.map((j) => (
              <li key={j.job_id}>
                <button
                  onClick={() => setActive(active?.job_id === j.job_id ? null : j)}
                  className={[
                    'w-full text-left px-4 py-2.5 border-b border-border transition-colors',
                    active?.job_id === j.job_id ? 'bg-panelHi' : 'hover:bg-panel/60',
                  ].join(' ')}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs truncate text-fg">{j.type}</span>
                    <StatusPill status={j.status} />
                  </div>
                  <div className="text-[10px] text-muted font-mono mt-1 flex justify-between gap-2">
                    <span className="truncate">{j.job_id}</span>
                    <span className="shrink-0">{j.created_at ? relTime(j.created_at) : '—'}</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {active && <JobDetail job={active} onClose={() => setActive(null)} />}
    </section>
  );
}

function JobDetail({ job, onClose }: { job: ToolJob; onClose: () => void }) {
  const [deps, setDeps] = useState<ToolJobDeps | null>(null);
  const [logLines, setLogLines] = useState<string[]>([]);
  const logRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setDeps(null);
    liveApi
      .jobDependencies(job.job_id)
      .then(setDeps)
      .catch(() => setDeps({ nodes: [], edges: [] }));
  }, [job.job_id]);

  useEffect(() => {
    setLogLines([]);
    const es = new EventSource(liveJobLogStreamUrl(job.job_id), { withCredentials: true });
    es.onmessage = (e) => {
      setLogLines((l) => [...l.slice(-499), e.data]);
      requestAnimationFrame(() => {
        if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
      });
    };
    es.onerror = () => es.close();
    return () => es.close();
  }, [job.job_id]);

  return (
    <div className="shrink-0 border-t border-border bg-panel/40 max-h-[60%] flex flex-col overflow-hidden">
      <div className="px-4 py-2 flex items-center justify-between border-b border-border bg-bg">
        <div className="font-mono text-[11px] truncate text-fg">{job.job_id}</div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="text-muted hover:text-fg text-base leading-none"
        >
          ×
        </button>
      </div>
      <div className="px-4 py-2.5 border-b border-border">
        <Eyebrow className="mb-1.5">Dependencies</Eyebrow>
        <DepsGraph deps={deps} />
      </div>
      <div
        ref={logRef}
        className="flex-1 min-h-0 overflow-y-auto bg-bg font-mono text-[11px] leading-relaxed px-4 py-2 whitespace-pre-wrap"
      >
        {logLines.length === 0 ? (
          <span className="text-muted">no log lines yet</span>
        ) : (
          logLines.join('\n')
        )}
      </div>
    </div>
  );
}

function DepsGraph({ deps }: { deps: ToolJobDeps | null }) {
  if (!deps) return <div className="text-xs text-muted">Loading…</div>;
  if (deps.nodes.length === 0) return <Empty compact />;

  const w = 320;
  const h = 80;
  const r = 6;
  const positions = new Map<string, { x: number; y: number }>();
  const cols = Math.max(1, Math.ceil(Math.sqrt(deps.nodes.length)));
  deps.nodes.forEach((n, i) => {
    const cx = ((i % cols) + 0.5) * (w / cols);
    const cy =
      (Math.floor(i / cols) + 0.5) * (h / Math.max(Math.ceil(deps.nodes.length / cols), 1));
    positions.set(n.id, { x: cx, y: cy });
  });

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-20">
      {deps.edges.map((e, i) => {
        const a = positions.get(e.src);
        const b = positions.get(e.dst);
        if (!a || !b) return null;
        return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#cdcdcd" strokeWidth={1} />;
      })}
      {deps.nodes.map((n) => {
        const p = positions.get(n.id)!;
        const fill = n.status === 'done' ? '#0a0a0a' : n.status === 'error' ? '#b91c1c' : '#fafaf9';
        return (
          <g key={n.id}>
            <circle cx={p.x} cy={p.y} r={r} fill={fill} stroke="#0a0a0a" strokeWidth={1} />
            <text x={p.x} y={p.y + r + 9} textAnchor="middle" fontSize="9" fill="#6b6b6b">
              {n.kind}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Enrichment ────────────────────────────────────────────────────────────

function SuggestionsColumn() {
  const [items, setItems] = useState<EnrichmentSuggestion[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);

  const load = () =>
    liveApi
      .enrichmentPending(50)
      .then((r) => setItems(r.suggestions))
      .catch(() => setItems([]));
  useEffect(() => {
    void load();
  }, []);

  const decide = async (id: string, decision: 'approve' | 'reject' | 'defer') => {
    setBusy(id);
    try {
      await liveApi.enrichmentDecide(id, decision);
      await load();
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="flex flex-col min-h-0 overflow-hidden">
      <ColumnHeader
        eyebrow="Enrichment"
        title="Suggestions"
        right={items && <span className="text-[10px] font-mono text-muted">{items.length}</span>}
      />
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-2">
        {items == null ? (
          <div className="text-xs text-muted">Loading…</div>
        ) : items.length === 0 ? (
          <Empty title="all caught up" hint="No pending enrichment suggestions." />
        ) : (
          items.map((s) => (
            <article
              key={s.id}
              className="border border-border rounded-md bg-bg p-3 hover:border-fg/40 transition-colors"
            >
              <div className="flex items-baseline justify-between gap-2">
                <Eyebrow>{s.kind}</Eyebrow>
                <div className="text-[10px] text-muted font-mono">{relTime(s.created_at)}</div>
              </div>
              <div className="font-display text-sm tracking-tightest leading-tight mt-1 truncate">
                {s.title || s.id}
              </div>
              {s.summary && (
                <p className="text-xs text-muted mt-1.5 line-clamp-3 whitespace-pre-wrap leading-relaxed">
                  {s.summary}
                </p>
              )}
              <div className="flex gap-1 mt-2.5">
                <Btn
                  size="sm"
                  variant="primary"
                  onClick={() => void decide(s.id, 'approve')}
                  disabled={busy === s.id}
                >
                  Approve
                </Btn>
                <Btn
                  size="sm"
                  variant="danger"
                  onClick={() => void decide(s.id, 'reject')}
                  disabled={busy === s.id}
                >
                  Reject
                </Btn>
                <Btn
                  size="sm"
                  onClick={() => void decide(s.id, 'defer')}
                  disabled={busy === s.id}
                >
                  Defer
                </Btn>
                <Btn
                  size="sm"
                  variant="ghost"
                  onClick={() => setPreviewId(s.id)}
                  className="ml-auto"
                >
                  Preview
                </Btn>
              </div>
            </article>
          ))
        )}
      </div>
      {previewId && <PreviewModal id={previewId} onClose={() => setPreviewId(null)} />}
    </section>
  );
}

function PreviewModal({ id, onClose }: { id: string; onClose: () => void }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof liveApi.enrichmentPreview>> | null>(
    null,
  );
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    liveApi.enrichmentPreview(id).then(setData).catch((e) => setErr((e as Error).message));
  }, [id]);
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-fg/30 backdrop-blur-[1px] animate-fadeIn" onClick={onClose} />
      <div className="relative bg-bg border border-border rounded-md shadow-card w-full max-w-2xl max-h-[80vh] overflow-y-auto animate-fadeIn">
        <div className="px-4 py-3 flex justify-between items-center border-b border-border">
          <div>
            <Eyebrow>Preview</Eyebrow>
            <div className="font-mono text-xs">{id}</div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-muted hover:text-fg text-base leading-none"
          >
            ×
          </button>
        </div>
        <div className="p-5 text-xs space-y-4">
          {err && <div className="text-red-700">{err}</div>}
          {!data ? (
            <div className="text-muted">Loading…</div>
          ) : (
            <>
              {data.diff && (
                <pre className="font-mono text-[11px] whitespace-pre-wrap bg-panel/40 border border-border rounded-sm p-3">
                  {data.diff}
                </pre>
              )}
              {data.proposed != null && (
                <pre className="font-mono text-[11px] whitespace-pre-wrap bg-panel/40 border border-border rounded-sm p-3">
                  {JSON.stringify(data.proposed, null, 2)}
                </pre>
              )}
              {data.evidence && data.evidence.length > 0 && (
                <div>
                  <Eyebrow className="mb-1.5">Evidence</Eyebrow>
                  <ul className="space-y-2">
                    {data.evidence.map((ev) => (
                      <li key={ev.id} className="border-l-2 border-border pl-2.5">
                        <p className="whitespace-pre-wrap leading-relaxed">{ev.text}</p>
                        {ev.url && (
                          <a
                            href={ev.url}
                            target="_blank"
                            rel="noreferrer"
                            className="underline text-[10px] text-muted hover:text-fg"
                          >
                            {ev.url}
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Triggers ──────────────────────────────────────────────────────────────

function TriggersColumn() {
  const [statuses, setStatuses] = useState<Record<string, TriggerStatus | null>>({});
  const [firing, setFiring] = useState<string | null>(null);

  const loadAll = () => {
    for (const k of TRIGGER_KINDS) {
      liveApi
        .triggerStatus(k)
        .then((s) => setStatuses((prev) => ({ ...prev, [k]: s })))
        .catch(() => setStatuses((prev) => ({ ...prev, [k]: null })));
    }
  };
  useEffect(() => {
    loadAll();
    const id = setInterval(loadAll, 15_000);
    return () => clearInterval(id);
  }, []);

  const fire = async (kind: TriggerKind) => {
    setFiring(kind);
    try {
      await liveApi.triggerFireNow(kind);
    } finally {
      setFiring(null);
      loadAll();
    }
  };

  return (
    <section className="flex flex-col min-h-0 overflow-hidden">
      <ColumnHeader eyebrow="Triggers" title="Decision panel" />
      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
        {TRIGGER_KINDS.map((k) => {
          const s = statuses[k];
          return (
            <div
              key={k}
              className="border border-border rounded-md bg-bg p-3 hover:border-fg/40 transition-colors"
            >
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-display text-base tracking-tightest leading-none">{k}</h3>
                {s ? (
                  <StatusPill
                    status={s.gate_state}
                    tone={s.gate_state === 'open' ? 'success' : 'neutral'}
                  >
                    {s.gate_state}
                  </StatusPill>
                ) : (
                  <span className="text-[10px] text-muted">…</span>
                )}
              </div>
              {s?.gate_reason && (
                <p className="text-[11px] text-muted mt-1 leading-relaxed">{s.gate_reason}</p>
              )}
              <div className="text-[10px] font-mono text-muted mt-1">
                next · {s?.next_fire_at ? relTime(s.next_fire_at) : '—'}
              </div>
              {s?.candidates && s.candidates.length > 0 && (
                <ul className="mt-2.5 text-[11px] space-y-0.5">
                  {s.candidates.slice(0, 5).map((c) => (
                    <li key={c.id} className="flex justify-between gap-2 items-baseline">
                      <span className="truncate text-fg/85">{c.title || c.id}</span>
                      {c.score != null && (
                        <span className="font-mono text-muted shrink-0">{c.score.toFixed(2)}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <Btn
                variant="primary"
                size="sm"
                className="mt-3"
                onClick={() => void fire(k)}
                disabled={firing === k}
              >
                {firing === k ? 'Firing…' : 'Fire now'}
              </Btn>
            </div>
          );
        })}
      </div>
    </section>
  );
}
