import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  api,
  ENRICHMENT_CATEGORIES,
  ENRICHMENT_EVENT_TYPES,
  type EnrichmentCategory,
  type EnrichmentEventType,
  type EnrichmentLogEntry,
  type GraphCoverageNode,
  type ScrapeTarget,
  type SchedulerStatus,
  type SuggestedScrapeTarget,
} from '../lib/api';
import { authClient } from '../lib/auth-client';

type Tab = 'sources' | 'suggestions' | 'log' | 'graph';

function relTime(iso: string | null): string {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return iso;
  const diff = Date.now() - t;
  const s = Math.round(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

function EnrichmentPage() {
  const [tab, setTab] = useState<Tab>('sources');
  const [status, setStatus] = useState<SchedulerStatus | null>(null);
  const [triggering, setTriggering] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const s = await api.enrichment.status();
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
      await api.enrichment.triggerCycle();
      setBanner('Cycle triggered — watch the Log tab for progress.');
    } catch (err) {
      setBanner(`Trigger failed: ${(err as Error).message}`);
    } finally {
      setTriggering(false);
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'sources', label: 'Sources' },
    { id: 'suggestions', label: 'Suggestions' },
    { id: 'log', label: 'Log' },
    { id: 'graph', label: 'Graph coverage' },
  ];

  return (
    <div className="min-h-screen bg-bg text-fg font-sans">
      <header className="border-b border-border px-8 py-5 flex items-center justify-between">
        <div className="flex items-baseline gap-6">
          <Link to="/chat" className="text-xs uppercase tracking-[0.2em] text-muted font-mono">
            ← back
          </Link>
          <h1 className="font-display text-2xl tracking-tightest">Enrichment</h1>
        </div>
        <div className="flex items-center gap-4">
          <StatusBadge status={status} />
          <button
            onClick={triggerCycle}
            disabled={triggering}
            className="text-[11px] uppercase tracking-[0.18em] font-mono border border-fg px-3 py-2 hover:bg-fg hover:text-bg transition-colors disabled:opacity-50"
          >
            {triggering ? 'triggering…' : 'run cycle now'}
          </button>
        </div>
      </header>

      {banner && (
        <div className="px-8 py-3 bg-panel border-b border-border text-sm text-muted font-mono">
          {banner}
        </div>
      )}

      <nav className="border-b border-border px-8 flex gap-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={[
              'px-4 py-3 text-[11px] uppercase tracking-[0.18em] font-mono border-b-2 -mb-px transition-colors',
              tab === t.id ? 'border-fg text-fg' : 'border-transparent text-muted hover:text-fg',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="px-8 py-6">
        {tab === 'sources' && <SourcesTab />}
        {tab === 'suggestions' && <SuggestionsTab />}
        {tab === 'log' && <LogTab />}
        {tab === 'graph' && <GraphCoverageTab />}
      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: SchedulerStatus | null }) {
  if (!status) {
    return (
      <span className="text-[10px] uppercase tracking-[0.18em] font-mono text-muted">
        scheduler: unknown
      </span>
    );
  }
  return (
    <span className="text-[10px] uppercase tracking-[0.18em] font-mono text-muted">
      <span className={status.running ? 'text-fg' : 'text-muted'}>
        {status.running ? '● running' : '○ idle'}
      </span>
      {' · '}
      {status.sources_due} due
      {status.next_run && ` · next ${relTime(status.next_run)}`}
    </span>
  );
}

// --- Sources tab ------------------------------------------------------------

function SourcesTab() {
  const [sources, setSources] = useState<ScrapeTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    url: '',
    category: 'documentation' as EnrichmentCategory,
    frequency_hours: 24,
  });

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.enrichment.sources();
      setSources(res.sources);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.enrichment.createSource(form);
      setShowForm(false);
      setForm({ name: '', url: '', category: 'documentation', frequency_hours: 24 });
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function toggleActive(s: ScrapeTarget) {
    try {
      await api.enrichment.updateSource(s.id, { active: !s.active });
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function triggerNow(id: number) {
    try {
      await api.enrichment.triggerSource(id);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function flushChunks(id: number) {
    if (
      !confirm(
        'Reset this source? Clears the content hash so the next cycle re-scrapes the page. Existing Chroma chunks are overwritten on re-ingest.',
      )
    )
      return;
    try {
      await api.enrichment.flushSource(id);
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function remove(id: number) {
    if (!confirm('Deactivate this source?')) return;
    try {
      await api.enrichment.deleteSource(id);
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-display text-xl">Sources</h2>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="text-[11px] uppercase tracking-[0.18em] font-mono border border-fg px-3 py-2 hover:bg-fg hover:text-bg transition-colors"
        >
          {showForm ? 'cancel' : '+ add source'}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={submitForm}
          className="bg-panel border border-border p-4 mb-6 grid grid-cols-2 gap-4"
        >
          <LabeledInput
            label="Name"
            value={form.name}
            onChange={(v) => setForm({ ...form, name: v })}
            required
          />
          <LabeledInput
            label="URL"
            value={form.url}
            onChange={(v) => setForm({ ...form, url: v })}
            type="url"
            required
          />
          <LabeledSelect
            label="Category"
            value={form.category}
            onChange={(v) => setForm({ ...form, category: v as EnrichmentCategory })}
            options={[...ENRICHMENT_CATEGORIES]}
          />
          <LabeledInput
            label="Frequency (hours)"
            type="number"
            value={String(form.frequency_hours)}
            onChange={(v) => setForm({ ...form, frequency_hours: Number(v) || 24 })}
            required
          />
          <div className="col-span-2 flex justify-end">
            <button
              type="submit"
              className="text-[11px] uppercase tracking-[0.18em] font-mono border border-fg px-4 py-2 hover:bg-fg hover:text-bg"
            >
              create
            </button>
          </div>
        </form>
      )}

      {error && <div className="text-xs font-mono text-red-700 mb-3">{error}</div>}
      {loading ? (
        <div className="text-sm text-muted">Loading…</div>
      ) : sources.length === 0 ? (
        <div className="text-sm text-muted font-mono">No sources yet.</div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-[0.16em] text-muted font-mono border-b border-border">
              <th className="text-left py-2">name</th>
              <th className="text-left py-2">url</th>
              <th className="text-left py-2">category</th>
              <th className="text-left py-2">freq</th>
              <th className="text-left py-2">last scraped</th>
              <th className="text-left py-2">status</th>
              <th className="text-right py-2">chunks</th>
              <th className="text-right py-2">actions</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((s) => (
              <tr key={s.id} className="border-b border-border hover:bg-panelHi">
                <td className="py-2">{s.name}</td>
                <td className="py-2 font-mono text-xs truncate max-w-[260px]">
                  <a href={s.url} target="_blank" rel="noreferrer" className="underline">
                    {s.url}
                  </a>
                </td>
                <td className="py-2 font-mono text-xs">{s.category}</td>
                <td className="py-2 font-mono text-xs">{s.frequency_hours}h</td>
                <td className="py-2 text-xs text-muted">{relTime(s.last_scraped_at)}</td>
                <td className="py-2 text-xs">
                  {s.status ?? '—'}
                  {!s.active && <span className="text-muted"> (inactive)</span>}
                </td>
                <td className="py-2 text-right font-mono text-xs">{s.chunk_count}</td>
                <td className="py-2 text-right">
                  <div className="flex gap-2 justify-end text-[10px] uppercase tracking-[0.14em] font-mono">
                    <button onClick={() => toggleActive(s)} className="hover:text-fg text-muted">
                      {s.active ? 'disable' : 'enable'}
                    </button>
                    <button onClick={() => triggerNow(s.id)} className="hover:text-fg text-muted">
                      scrape
                    </button>
                    <button onClick={() => flushChunks(s.id)} className="hover:text-fg text-muted">
                      flush
                    </button>
                    <button onClick={() => remove(s.id)} className="hover:text-red-700 text-muted">
                      delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// --- Suggestions tab --------------------------------------------------------

function SuggestionsTab() {
  const [items, setItems] = useState<SuggestedScrapeTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<number | null>(null);
  const [freq, setFreq] = useState(24);

  async function load() {
    setLoading(true);
    try {
      const res = await api.enrichment.suggestions();
      setItems(res.suggestions);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function approve(id: number) {
    try {
      await api.enrichment.reviewSuggestion(id, { status: 'approved', frequency_hours: freq });
      setReviewing(null);
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function reject(id: number) {
    try {
      await api.enrichment.reviewSuggestion(id, { status: 'rejected' });
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (loading) return <div className="text-sm text-muted">Loading…</div>;
  if (error) return <div className="text-xs font-mono text-red-700">{error}</div>;
  if (items.length === 0)
    return <div className="text-sm text-muted font-mono">No pending suggestions.</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((s) => {
        const borderColor =
          s.confidence === 'high'
            ? 'border-green-600'
            : s.confidence === 'medium'
              ? 'border-amber-600'
              : 'border-red-600';
        return (
          <div
            key={s.id}
            className={`bg-panel border-l-4 ${borderColor} border-t border-r border-b border-border p-4`}
          >
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-display text-lg">{s.name}</h3>
              <span className="text-[10px] uppercase tracking-[0.14em] font-mono text-muted">
                {s.confidence} · score {s.confidence_score}
              </span>
            </div>
            <a
              href={s.url}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-mono text-muted underline break-all"
            >
              {s.url}
            </a>
            <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-muted mt-2">
              {s.category} · seen {s.times_suggested}×
            </div>
            {s.reason && <p className="text-sm text-fg mt-3">{s.reason}</p>}
            {reviewing === s.id ? (
              <div className="mt-4 flex items-center gap-2">
                <label className="text-[10px] uppercase tracking-[0.14em] font-mono text-muted">
                  freq
                </label>
                <input
                  type="number"
                  value={freq}
                  onChange={(e) => setFreq(Number(e.target.value) || 24)}
                  className="w-16 bg-bg border border-border px-2 py-1 text-xs font-mono"
                />
                <button
                  onClick={() => approve(s.id)}
                  className="text-[10px] uppercase tracking-[0.14em] font-mono border border-fg px-3 py-1 hover:bg-fg hover:text-bg"
                >
                  confirm
                </button>
                <button
                  onClick={() => setReviewing(null)}
                  className="text-[10px] uppercase tracking-[0.14em] font-mono text-muted"
                >
                  cancel
                </button>
              </div>
            ) : (
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => {
                    setReviewing(s.id);
                    setFreq(24);
                  }}
                  className="text-[10px] uppercase tracking-[0.14em] font-mono border border-fg px-3 py-1 hover:bg-fg hover:text-bg"
                >
                  approve
                </button>
                <button
                  onClick={() => reject(s.id)}
                  className="text-[10px] uppercase tracking-[0.14em] font-mono border border-border px-3 py-1 hover:border-red-700 hover:text-red-700"
                >
                  reject
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// --- Log tab ----------------------------------------------------------------

function LogTab() {
  const [entries, setEntries] = useState<EnrichmentLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit] = useState(100);
  const [total, setTotal] = useState(0);
  const [selectedEvents, setSelectedEvents] = useState<EnrichmentEventType[]>([]);
  const [sourceFilter, setSourceFilter] = useState<number | ''>('');
  const [cycleFilter, setCycleFilter] = useState<string>('');
  const [sources, setSources] = useState<ScrapeTarget[]>([]);
  const [knownCycles, setKnownCycles] = useState<string[]>([]);

  useEffect(() => {
    api.enrichment.sources().then((r) => setSources(r.sources)).catch(() => undefined);
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api.enrichment
      .log({
        page,
        limit,
        event_type: selectedEvents.length ? selectedEvents.join(',') : undefined,
        scrape_target_id: sourceFilter === '' ? undefined : Number(sourceFilter),
        cycle_id: cycleFilter || undefined,
      })
      .then((r) => {
        setEntries(r.entries);
        setTotal(r.total);
        // Remember every cycle id we've seen so the filter dropdown grows
        // with the user's browsing, even across paginated windows.
        setKnownCycles((prev) => {
          const seen = new Set(prev);
          for (const e of r.entries) if (e.cycle_id) seen.add(e.cycle_id);
          return Array.from(seen).sort().reverse();
        });
      })
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [page, limit, selectedEvents, sourceFilter, cycleFilter]);

  const grouped = useMemo(() => {
    const groups = new Map<string, EnrichmentLogEntry[]>();
    for (const e of entries) {
      const key = e.cycle_id || 'uncycled';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(e);
    }
    return Array.from(groups.entries());
  }, [entries]);

  function toggleEvent(ev: EnrichmentEventType) {
    setPage(1);
    setSelectedEvents((prev) =>
      prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev],
    );
  }

  const maxPage = Math.max(1, Math.ceil(total / limit));

  return (
    <div>
      <div className="bg-panel border border-border p-4 mb-4">
        <div className="text-[10px] uppercase tracking-[0.14em] font-mono text-muted mb-2">
          event type
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {ENRICHMENT_EVENT_TYPES.map((ev) => (
            <button
              key={ev}
              onClick={() => toggleEvent(ev)}
              className={[
                'text-[10px] uppercase tracking-[0.14em] font-mono px-2 py-1 border',
                selectedEvents.includes(ev)
                  ? 'border-fg bg-fg text-bg'
                  : 'border-border text-muted hover:text-fg',
              ].join(' ')}
            >
              {ev}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <label className="text-[10px] uppercase tracking-[0.14em] font-mono text-muted">
              source
            </label>
            <select
              value={sourceFilter}
              onChange={(e) => {
                setPage(1);
                setSourceFilter(e.target.value === '' ? '' : Number(e.target.value));
              }}
              className="bg-bg border border-border px-2 py-1 text-xs font-mono"
            >
              <option value="">all</option>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-[10px] uppercase tracking-[0.14em] font-mono text-muted">
              cycle
            </label>
            <select
              value={cycleFilter}
              onChange={(e) => {
                setPage(1);
                setCycleFilter(e.target.value);
              }}
              className="bg-bg border border-border px-2 py-1 text-xs font-mono"
            >
              <option value="">all</option>
              {knownCycles.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && <div className="text-xs font-mono text-red-700 mb-3">{error}</div>}
      {loading ? (
        <div className="text-sm text-muted">Loading…</div>
      ) : grouped.length === 0 ? (
        <div className="text-sm text-muted font-mono">No log entries.</div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([cycleId, rows]) => {
            const tokens = rows.reduce((a, r) => a + (r.tokens_used ?? 0), 0);
            const counts: Record<string, number> = {};
            for (const r of rows) counts[r.event_type] = (counts[r.event_type] ?? 0) + 1;
            return (
              <div key={cycleId}>
                <div className="border-b border-fg pb-2 mb-2 flex justify-between items-baseline">
                  <span className="font-mono text-xs text-fg">cycle {cycleId}</span>
                  <span className="text-[10px] uppercase tracking-[0.14em] font-mono text-muted">
                    {tokens.toLocaleString()} tokens ·{' '}
                    {Object.entries(counts)
                      .map(([k, v]) => `${k}:${v}`)
                      .join(' · ')}
                  </span>
                </div>
                <div className="divide-y divide-border">
                  {rows.map((r) => (
                    <LogRow key={r.id} row={r} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex justify-between items-center mt-6 text-[10px] uppercase tracking-[0.14em] font-mono text-muted">
        <span>
          page {page} / {maxPage} · {total} entries
        </span>
        <div className="flex gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-2 py-1 border border-border disabled:opacity-30 hover:text-fg"
          >
            prev
          </button>
          <button
            disabled={page >= maxPage}
            onClick={() => setPage((p) => p + 1)}
            className="px-2 py-1 border border-border disabled:opacity-30 hover:text-fg"
          >
            next
          </button>
        </div>
      </div>
    </div>
  );
}

function LogRow({ row }: { row: EnrichmentLogEntry }) {
  const highlight =
    row.event_type === 'deferred'
      ? 'bg-amber-50'
      : row.event_type === 'budget_exhausted'
        ? 'bg-red-50'
        : '';
  return (
    <div className={`py-2 flex items-start gap-3 text-xs ${highlight}`}>
      <span className="font-mono text-muted w-40 shrink-0">
        {row.event_type}
      </span>
      <span className="font-mono text-muted w-48 shrink-0 truncate">
        {row.source_url ?? '—'}
      </span>
      <span className="flex-1 text-fg">{row.message ?? ''}</span>
      <span className="font-mono text-muted w-20 text-right shrink-0">
        {row.tokens_used != null ? `${row.tokens_used}t` : ''}
      </span>
      <span className="font-mono text-muted w-16 text-right shrink-0">
        {row.duration_seconds != null ? `${row.duration_seconds.toFixed(1)}s` : ''}
      </span>
    </div>
  );
}

// --- Graph coverage tab -----------------------------------------------------

function GraphCoverageTab() {
  const [nodes, setNodes] = useState<GraphCoverageNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.enrichment
      .graphCoverage()
      .then((r) => {
        const list = Array.isArray(r) ? r : r.nodes;
        setNodes(list ?? []);
      })
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-sm text-muted">Loading…</div>;
  if (error) return <div className="text-xs font-mono text-red-700">{error}</div>;
  if (nodes.length === 0)
    return (
      <div className="text-sm text-muted font-mono">
        No concept nodes yet — run an enrichment cycle first.
      </div>
    );

  return (
    <div>
      <h2 className="font-display text-xl mb-2">Graph coverage</h2>
      <p className="text-sm text-muted mb-4">
        Concept nodes by connection count. Red bars ({'<'} 3 connections) are what
        proactive search targets.
      </p>
      <div className="w-full h-[480px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={nodes}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e6e6e4" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10, fontFamily: 'monospace' }}
              angle={-40}
              textAnchor="end"
              height={100}
              interval={0}
            />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Bar dataKey="degree">
              {nodes.map((n, i) => (
                <Cell key={i} fill={n.degree < 3 ? '#b91c1c' : '#0a0a0a'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// --- Small form helpers -----------------------------------------------------

function LabeledInput({
  label,
  value,
  onChange,
  type = 'text',
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-[0.16em] text-muted mb-1.5 font-mono">
        {label}
      </span>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-bg border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-fg"
      />
    </label>
  );
}

function LabeledSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-[0.16em] text-muted mb-1.5 font-mono">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-bg border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-fg"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

export const Route = createFileRoute('/enrichment')({
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data?.user) {
      throw redirect({ to: '/login' });
    }
  },
  component: EnrichmentPage,
});
