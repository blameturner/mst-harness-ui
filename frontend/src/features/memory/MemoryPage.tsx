import { useEffect, useMemo, useState } from 'react';
import {
  memoryApi,
  type MemoryAskResponse,
  type MemoryCollection,
  type MemoryHealth,
  type MemorySearchHit,
} from '../../api/memory';
import {
  Btn,
  Empty,
  Eyebrow,
  Field,
  PageHeader,
  TabRow,
  TextInput,
  type TabDef,
} from '../../components/ui';
import { relTime } from '../../lib/utils/relTime';

type Tab = 'ask' | 'search' | 'health';
const TABS: ReadonlyArray<TabDef<Tab>> = [
  { id: 'ask', label: 'Ask' },
  { id: 'search', label: 'Search' },
  { id: 'health', label: 'Health' },
];

export function MemoryPage() {
  const [tab, setTab] = useState<Tab>('ask');
  const [collections, setCollections] = useState<MemoryCollection[] | null>(null);
  const [health, setHealth] = useState<MemoryHealth | null>(null);
  const [healthErr, setHealthErr] = useState<string | null>(null);

  useEffect(() => {
    memoryApi
      .collections()
      .then((r) => setCollections(r.collections))
      .catch(() => setCollections([]));
  }, []);
  useEffect(() => {
    if (tab !== 'health') return;
    setHealthErr(null);
    memoryApi.health().then(setHealth).catch((e) => setHealthErr((e as Error).message));
  }, [tab]);

  return (
    <div className="h-full flex flex-col bg-bg text-fg font-sans">
      <PageHeader
        eyebrow="Knowledge index"
        title="Memory"
        right={<TabRow tabs={TABS} active={tab} onChange={setTab} size="sm" />}
      />

      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === 'ask' && <AskView collections={collections} />}
        {tab === 'search' && <SearchView collections={collections} />}
        {tab === 'health' && <HealthView health={health} error={healthErr} />}
      </div>
    </div>
  );
}

function AskView({ collections }: { collections: MemoryCollection[] | null }) {
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [resp, setResp] = useState<MemoryAskResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [forgotten, setForgotten] = useState<Set<string>>(new Set());

  const forget = async (chunkId: string, collection: string) => {
    if (forgotten.has(chunkId)) return;
    if (!window.confirm(`Forget this snippet from "${collection}"? This can't be undone.`)) return;
    try {
      await memoryApi.forget(chunkId, collection);
      setForgotten((prev) => new Set(prev).add(chunkId));
    } catch (e) {
      alert(`forget failed: ${(e as Error).message}`);
    }
  };

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!q.trim() || loading) return;
    setLoading(true);
    setErr(null);
    setResp(null);
    try {
      const r = await memoryApi.ask({
        query: q.trim(),
        collections: selected.size ? [...selected] : undefined,
        n_results: 6,
        max_tokens: 600,
      });
      setResp(r);
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const toggle = (name: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  return (
    <div className="h-full overflow-y-auto">
      <form onSubmit={submit} className="border-b border-border bg-panel/20 px-5 sm:px-8 py-5 space-y-4">
        <div className="flex gap-2 items-stretch">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ask a question about everything I've stored…"
            className="flex-1 bg-bg border border-border rounded-sm px-4 py-3 text-base font-display tracking-tight focus:outline-none focus:border-fg focus:ring-2 focus:ring-fg/15"
          />
          <Btn type="submit" variant="primary" disabled={!q.trim() || loading}>
            {loading ? 'Thinking…' : 'Ask'}
          </Btn>
        </div>
        {collections && collections.length > 0 && (
          <div>
            <Eyebrow className="mb-2">Limit to collections (optional)</Eyebrow>
            <div className="flex flex-wrap gap-1">
              {collections.map((c) => {
                const on = selected.has(c.name);
                return (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => toggle(c.name)}
                    className={[
                      'px-2 py-1 text-[10px] uppercase tracking-[0.16em] border rounded-sm transition-colors',
                      on
                        ? 'border-fg bg-fg text-bg'
                        : 'border-border text-muted hover:text-fg hover:border-fg',
                    ].join(' ')}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </form>

      <div className="px-5 sm:px-8 py-5 space-y-5">
        {err && (
          <div className="border border-red-200 bg-red-50 rounded-sm px-3 py-2 text-xs text-red-800">
            {err}
          </div>
        )}
        {!resp && !loading && (
          <Empty
            title="ready"
            hint="Ask anything — I'll search across memory and synthesise an answer with citations."
          />
        )}
        {loading && <div className="text-xs text-muted">Searching memory and synthesising…</div>}
        {resp && (
          <>
            <article className="border border-border rounded-md bg-bg p-5 space-y-3">
              <Eyebrow>answer</Eyebrow>
              <p className="text-sm whitespace-pre-wrap leading-relaxed text-fg/90">{resp.answer}</p>
              {resp.collections_searched.length > 0 && (
                <div className="text-[10px] uppercase tracking-[0.16em] text-muted">
                  searched: {resp.collections_searched.join(', ')}
                </div>
              )}
            </article>
            {resp.sources.length > 0 && (
              <div>
                <Eyebrow className="mb-2">Sources ({resp.sources.length})</Eyebrow>
                <ul className="space-y-2">
                  {resp.sources.map((s) => {
                    const isForgotten = !!s.chunk_id && forgotten.has(s.chunk_id);
                    return (
                      <li
                        key={s.id}
                        className={[
                          'border border-border rounded-md bg-bg px-4 py-3 space-y-1.5',
                          isForgotten ? 'opacity-50' : '',
                        ].join(' ')}
                      >
                        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-muted">
                          <span className="font-mono normal-case tracking-normal text-fg/80">
                            [{s.id}] {s.collection}
                          </span>
                          {s.distance != null && (
                            <span className="font-mono normal-case tracking-normal">
                              d={s.distance.toFixed(3)}
                            </span>
                          )}
                          {s.chunk_id && (
                            <button
                              type="button"
                              onClick={() => forget(s.chunk_id!, s.collection)}
                              disabled={isForgotten}
                              className={[
                                'ml-auto normal-case tracking-normal underline decoration-dotted',
                                isForgotten
                                  ? 'text-muted cursor-not-allowed'
                                  : 'text-red-700 hover:text-red-900',
                              ].join(' ')}
                              title="Delete this chunk from memory"
                            >
                              {isForgotten ? 'forgotten' : 'forget'}
                            </button>
                          )}
                        </div>
                        <p className="text-xs leading-relaxed text-fg/85">{s.snippet}</p>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SearchView({ collections }: { collections: MemoryCollection[] | null }) {
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [domain, setDomain] = useState('');
  const [maxAge, setMaxAge] = useState('');
  const [minScore, setMinScore] = useState('');
  const [hits, setHits] = useState<MemorySearchHit[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [activeCollection, setActiveCollection] = useState<string | null>(null);
  const [activeStats, setActiveStats] = useState<MemoryCollection | null>(null);

  useEffect(() => {
    if (!activeCollection) return;
    setActiveStats(null);
    memoryApi
      .collectionStats(activeCollection)
      .then(setActiveStats)
      .catch(() => setActiveStats(null));
  }, [activeCollection]);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!q.trim()) return;
    setLoading(true);
    setErr(null);
    try {
      const r = await memoryApi.search({
        q: q.trim(),
        collections: selected.size ? [...selected] : undefined,
        domain: domain || undefined,
        max_age_days: maxAge ? Number(maxAge) : undefined,
        min_score: minScore ? Number(minScore) : undefined,
        limit: 50,
      });
      setHits(r.hits);
    } catch (e2) {
      setErr((e2 as Error).message);
      setHits([]);
    } finally {
      setLoading(false);
    }
  };

  const toggle = (name: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  return (
    <div className="h-full flex">
      <aside className="w-64 shrink-0 border-r border-border bg-panel/40 overflow-y-auto py-4 hidden md:block">
        <div className="px-4 mb-3">
          <Eyebrow>Collections</Eyebrow>
        </div>
        {collections == null ? (
          <div className="px-4 text-xs text-muted">Loading…</div>
        ) : collections.length === 0 ? (
          <div className="px-4">
            <Empty compact />
          </div>
        ) : (
          <ul>
            {collections.map((c) => (
              <li key={c.name}>
                <button
                  onClick={() =>
                    setActiveCollection(c.name === activeCollection ? null : c.name)
                  }
                  className={[
                    'w-full text-left px-4 py-1.5 text-xs flex items-center justify-between gap-2 transition-colors',
                    activeCollection === c.name
                      ? 'bg-bg text-fg shadow-[inset_2px_0_0_0_var(--tw-shadow-color)] shadow-fg'
                      : 'text-fg/85 hover:bg-panelHi',
                  ].join(' ')}
                >
                  <span className="truncate font-mono">{c.name}</span>
                  <span className="font-mono text-[10px] text-muted">
                    {c.chunk_count.toLocaleString()}
                  </span>
                </button>
                {activeCollection === c.name && (
                  <div className="px-4 py-2">
                    {activeStats?.freshness?.length ? (
                      <Sparkline values={activeStats.freshness} />
                    ) : (
                      <div className="text-[10px] text-muted">no freshness data</div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </aside>

      <div className="flex-1 min-w-0 overflow-y-auto">
        <form
          onSubmit={submit}
          className="border-b border-border bg-panel/20 px-5 sm:px-8 py-5 space-y-4"
        >
          <div className="flex gap-2 items-stretch">
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ask the memory…"
              className="flex-1 bg-bg border border-border rounded-sm px-4 py-3 text-base font-display tracking-tight focus:outline-none focus:border-fg focus:ring-2 focus:ring-fg/15"
            />
            <Btn type="submit" variant="primary" disabled={!q.trim() || loading}>
              {loading ? 'Searching…' : 'Search'}
            </Btn>
          </div>

          {collections && collections.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {collections.map((c) => {
                const on = selected.has(c.name);
                return (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => toggle(c.name)}
                    className={[
                      'px-2 py-1 text-[10px] uppercase tracking-[0.16em] border rounded-sm transition-colors',
                      on
                        ? 'border-fg bg-fg text-bg'
                        : 'border-border text-muted hover:text-fg hover:border-fg',
                    ].join(' ')}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="domain">
              <TextInput
                density="compact"
                mono
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="example.com"
              />
            </Field>
            <Field label="max age (days)">
              <TextInput
                density="compact"
                mono
                value={maxAge}
                onChange={(e) => setMaxAge(e.target.value.replace(/[^0-9]/g, ''))}
                inputMode="numeric"
                placeholder="∞"
              />
            </Field>
            <Field label="min score">
              <TextInput
                density="compact"
                mono
                value={minScore}
                onChange={(e) => setMinScore(e.target.value.replace(/[^0-9.]/g, ''))}
                inputMode="decimal"
                placeholder="0.00"
              />
            </Field>
          </div>
        </form>

        <div className="px-5 sm:px-8 py-5">
          {err && (
            <div className="border border-red-200 bg-red-50 rounded-sm px-3 py-2 text-xs text-red-800 mb-3">
              {err}
            </div>
          )}
          {hits == null ? (
            <Empty title="ready" hint="Run a search to see results." />
          ) : hits.length === 0 ? (
            <Empty />
          ) : (
            <ul className="space-y-2">
              {hits.map((h) => (
                <ResultCard key={h.id} hit={h} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function ResultCard({ hit }: { hit: MemorySearchHit }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="border border-border rounded-md bg-bg overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left px-4 py-3 hover:bg-panel/60 transition-colors"
      >
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-display text-base tracking-tightest truncate flex-1 leading-tight">
            {hit.title || hit.id}
          </h3>
          <span
            className="shrink-0 font-mono text-[11px] text-fg border border-border rounded-sm px-1.5 py-0.5 bg-panel"
            title="distance"
          >
            {hit.distance.toFixed(2)}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] uppercase tracking-[0.16em] text-muted">
          <span className="font-mono normal-case tracking-normal text-fg/70">
            {hit.collection}
          </span>
          {hit.domain && <span>{hit.domain}</span>}
          {hit.age_seconds != null && <span>{Math.round(hit.age_seconds / 86400)}d old</span>}
          {hit.url && (
            <a
              href={hit.url}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="underline hover:no-underline truncate normal-case tracking-normal text-fg/80"
            >
              {hit.url}
            </a>
          )}
        </div>
      </button>
      {open && (
        <div className="px-4 py-3 border-t border-border bg-panel/30 space-y-3">
          <p className="text-sm whitespace-pre-wrap leading-relaxed text-fg/90">{hit.text}</p>
          {hit.neighbours && hit.neighbours.length > 0 && (
            <div className="border-t border-border pt-2">
              <Eyebrow className="mb-1.5">Neighbours</Eyebrow>
              <ul className="space-y-1">
                {hit.neighbours.map((n) => (
                  <li key={n.id} className="text-[11px] text-muted">
                    <span className="font-mono mr-2 text-fg/70">{n.id}</span>
                    {n.title || n.text.slice(0, 120)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const path = useMemo(() => {
    if (!values.length) return '';
    const max = Math.max(...values, 1);
    const w = 200;
    const h = 28;
    const step = w / Math.max(values.length - 1, 1);
    return values
      .map(
        (v, i) =>
          `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${(h - (v / max) * h).toFixed(1)}`,
      )
      .join(' ');
  }, [values]);
  return (
    <svg viewBox="0 0 200 28" className="block w-full max-w-[200px] h-7 text-fg/70">
      <path d={path} fill="none" stroke="currentColor" strokeWidth={1.25} />
    </svg>
  );
}

function HealthView({ health, error }: { health: MemoryHealth | null; error: string | null }) {
  return (
    <div className="px-5 sm:px-8 py-6 max-w-3xl">
      {error && (
        <div className="border border-red-200 bg-red-50 rounded-sm px-3 py-2 text-xs text-red-800 mb-4">
          {error}
        </div>
      )}
      {!health ? (
        <div className="text-xs text-muted">Loading health…</div>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <span
              className={`w-2 h-2 rounded-full ${
                health.ok ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
            <Eyebrow>{health.ok ? 'healthy' : 'degraded'}</Eyebrow>
          </div>
          <dl className="grid grid-cols-[10rem_1fr] gap-y-2 text-sm">
            <dt className="text-muted">collections</dt>
            <dd className="font-mono">{health.collections.toLocaleString()}</dd>
            <dt className="text-muted">chunks total</dt>
            <dd className="font-mono">{health.chunks_total.toLocaleString()}</dd>
            {health.last_index_at && (
              <>
                <dt className="text-muted">last index</dt>
                <dd className="font-mono">{relTime(health.last_index_at)}</dd>
              </>
            )}
          </dl>
          {health.notes && health.notes.length > 0 && (
            <div>
              <Eyebrow className="mb-1">notes</Eyebrow>
              <ul className="text-xs space-y-1">
                {health.notes.map((n, i) => (
                  <li key={i} className="border-l-2 border-border pl-2">
                    {n}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
