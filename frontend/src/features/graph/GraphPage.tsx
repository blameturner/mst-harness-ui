import { useEffect, useMemo, useRef, useState } from 'react';
import {
  graphApi,
  type GraphAskResponse,
  type GraphDiff,
  type GraphEdge,
  type GraphEvidence,
  type GraphMaintenanceEvent,
  type GraphNeighbourhood,
  type GraphNode,
  type GraphPath,
  type GraphResolutionPair,
  type GraphSearchHit,
  type GraphStats,
} from '../../api/graph';
import {
  Btn,
  Drawer,
  Empty,
  Eyebrow,
  PageHeader,
  TabRow,
  TextInput,
  type TabDef,
} from '../../components/ui';
import { relTime } from '../../lib/utils/relTime';

type Tab = 'ask' | 'explore' | 'path' | 'diff' | 'resolution' | 'health';
const TABS: ReadonlyArray<TabDef<Tab>> = [
  { id: 'ask', label: 'Ask' },
  { id: 'explore', label: 'Explore' },
  { id: 'path', label: 'Path' },
  { id: 'diff', label: 'Diff' },
  { id: 'resolution', label: 'Resolution' },
  { id: 'health', label: 'Health' },
];

export function GraphPage() {
  const [tab, setTab] = useState<Tab>('ask');

  return (
    <div className="h-full flex flex-col bg-bg text-fg font-sans">
      <PageHeader
        eyebrow="Knowledge graph"
        title="Graph"
        right={<TabRow tabs={TABS} active={tab} onChange={setTab} size="sm" />}
      />

      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === 'ask' && <AskTab />}
        {tab === 'explore' && <ExploreTab />}
        {tab === 'path' && <PathTab />}
        {tab === 'diff' && <DiffTab />}
        {tab === 'resolution' && <ResolutionTab />}
        {tab === 'health' && <HealthTab />}
      </div>
    </div>
  );
}

function AskTab() {
  const [q, setQ] = useState('');
  const [resp, setResp] = useState<GraphAskResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!q.trim() || loading) return;
    setLoading(true);
    setErr(null);
    setResp(null);
    try {
      setResp(await graphApi.ask(q.trim(), { max_hops: 1, max_tokens: 600 }));
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <form
        onSubmit={submit}
        className="border-b border-border bg-panel/20 px-5 sm:px-8 py-5"
      >
        <div className="flex gap-2 items-stretch">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ask the graph — 'how is X connected to Y', 'who works on Z'…"
            className="flex-1 bg-bg border border-border rounded-sm px-4 py-3 text-base font-display tracking-tight focus:outline-none focus:border-fg focus:ring-2 focus:ring-fg/15"
          />
          <Btn type="submit" variant="primary" disabled={!q.trim() || loading}>
            {loading ? 'Searching…' : 'Ask'}
          </Btn>
        </div>
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
            hint="Ask anything — I'll match entities in the graph and synthesise an answer over their relationships."
          />
        )}
        {loading && <div className="text-xs text-muted">Traversing graph and synthesising…</div>}
        {resp && (
          <>
            <article className="border border-border rounded-md bg-bg p-5 space-y-3">
              <Eyebrow>answer</Eyebrow>
              <p className="text-sm whitespace-pre-wrap leading-relaxed text-fg/90">{resp.answer}</p>
              {resp.matched_entities.length > 0 && (
                <div className="text-[10px] uppercase tracking-[0.16em] text-muted">
                  matched: {resp.matched_entities.join(', ')}
                </div>
              )}
            </article>
            {resp.edges.length > 0 && (
              <div>
                <Eyebrow className="mb-2">Triples used ({resp.edges.length})</Eyebrow>
                <ul className="space-y-1">
                  {resp.edges.slice(0, 30).map((e, i) => (
                    <li
                      key={i}
                      className="border border-border rounded-md bg-bg px-4 py-2 text-xs flex items-center gap-2"
                    >
                      <span className="font-mono text-fg/80 truncate flex-1">
                        ({e.from}) -[{e.relationship}]-&gt; ({e.to})
                      </span>
                      {e.confidence != null && (
                        <span className="font-mono text-[10px] text-muted shrink-0">
                          {(e.confidence * 100).toFixed(0)}%
                        </span>
                      )}
                      <span className="font-mono text-[10px] text-muted shrink-0">
                        ×{e.hits}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function DiffTab() {
  const [days, setDays] = useState(7);
  const [diff, setDiff] = useState<GraphDiff | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setErr(null);
    graphApi
      .diff(days)
      .then(setDiff)
      .catch((e) => setErr((e as Error).message))
      .finally(() => setLoading(false));
  }, [days]);

  return (
    <div className="h-full overflow-y-auto px-5 sm:px-8 py-5 space-y-6">
      <div className="flex items-center gap-3">
        <Eyebrow>window</Eyebrow>
        {[1, 7, 30].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={[
              'px-3 py-1 text-[11px] uppercase tracking-[0.16em] border rounded-sm transition-colors',
              days === d
                ? 'border-fg bg-fg text-bg'
                : 'border-border text-muted hover:text-fg hover:border-fg',
            ].join(' ')}
          >
            {d}d
          </button>
        ))}
      </div>
      {err && (
        <div className="border border-red-200 bg-red-50 rounded-sm px-3 py-2 text-xs text-red-800">
          {err}
        </div>
      )}
      {loading && <div className="text-xs text-muted">Loading diff…</div>}
      {diff && (
        <div className="grid md:grid-cols-2 gap-6">
          <section className="space-y-2">
            <Eyebrow>new entities ({diff.new_entities.length})</Eyebrow>
            {diff.new_entities.length === 0 ? (
              <Empty compact />
            ) : (
              <ul className="text-xs font-mono space-y-0.5">
                {diff.new_entities.slice(0, 50).map((n) => (
                  <li key={n} className="border-l-2 border-emerald-400 pl-2 text-fg/85">
                    {n}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="space-y-2">
            <Eyebrow>refreshed entities ({diff.refreshed_entities.length})</Eyebrow>
            {diff.refreshed_entities.length === 0 ? (
              <Empty compact />
            ) : (
              <ul className="text-xs font-mono space-y-0.5">
                {diff.refreshed_entities.slice(0, 50).map((n) => (
                  <li key={n} className="border-l-2 border-amber-400 pl-2 text-fg/85">
                    {n}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="space-y-2 md:col-span-2">
            <Eyebrow>new edges ({diff.new_edges.length})</Eyebrow>
            {diff.new_edges.length === 0 ? (
              <Empty compact />
            ) : (
              <ul className="space-y-1">
                {diff.new_edges.slice(0, 40).map((e, i) => (
                  <li
                    key={i}
                    className="border border-border rounded-md bg-bg px-3 py-1.5 text-[11px] font-mono flex items-center gap-2"
                  >
                    <span className="text-fg/85 truncate flex-1">
                      {e.from} -[{e.relationship}]-&gt; {e.to}
                    </span>
                    <span className="text-muted shrink-0">×{e.hits}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

// ── Explore ──────────────────────────────────────────────────────────────

function ExploreTab() {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<GraphSearchHit[] | null>(null);
  const [searching, setSearching] = useState(false);

  const [centerId, setCenterId] = useState<string | null>(null);
  const [hops, setHops] = useState(2);
  const [nb, setNb] = useState<GraphNeighbourhood | null>(null);
  const [hover, setHover] = useState<GraphNode | null>(null);
  const [hoverAliases, setHoverAliases] = useState<string[] | null>(null);

  const [edge, setEdge] = useState<GraphEdge | null>(null);
  const [edgeData, setEdgeData] = useState<GraphEvidence | null>(null);

  useEffect(() => {
    if (!centerId) return;
    setNb(null);
    graphApi
      .neighbourhood(centerId, hops)
      .then(setNb)
      .catch(() => setNb({ nodes: [], edges: [], center: centerId }));
  }, [centerId, hops]);

  useEffect(() => {
    if (!hover) {
      setHoverAliases(null);
      return;
    }
    let cancelled = false;
    graphApi.node(hover.id).then((n) => {
      if (!cancelled) setHoverAliases(n.aliases ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [hover?.id]);

  useEffect(() => {
    if (!edge) {
      setEdgeData(null);
      return;
    }
    setEdgeData(null);
    graphApi.edgeEvidence(edge.src, edge.dst).then(setEdgeData).catch(() => setEdgeData(null));
  }, [edge?.src, edge?.dst]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    setSearching(true);
    try {
      const r = await graphApi.search(q.trim(), 25);
      setHits(r.hits);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="h-full flex">
      <aside className="w-72 shrink-0 border-r border-border bg-panel/30 flex flex-col">
        <form onSubmit={submit} className="p-3 border-b border-border">
          <TextInput
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search nodes…"
          />
        </form>
        <div className="flex-1 min-h-0 overflow-y-auto">
          {hits == null ? (
            <div className="px-4 py-3 text-xs text-muted">
              {searching ? 'Searching…' : 'Search to explore.'}
            </div>
          ) : hits.length === 0 ? (
            <div className="px-4 py-3">
              <Empty compact />
            </div>
          ) : (
            <ul>
              {hits.map((h) => {
                const active = centerId === h.id;
                return (
                  <li key={h.id}>
                    <button
                      onClick={() => setCenterId(h.id)}
                      className={[
                        'w-full text-left px-4 py-2.5 border-b border-border transition-colors',
                        active
                          ? 'bg-bg shadow-[inset_2px_0_0_0_var(--tw-shadow-color)] shadow-fg'
                          : 'hover:bg-panelHi',
                      ].join(' ')}
                    >
                      <div className="text-sm truncate text-fg">{h.label}</div>
                      <div className="flex justify-between text-[10px] uppercase tracking-[0.16em] text-muted mt-0.5">
                        <span>{h.type}</span>
                        <span className="font-mono">deg {h.degree}</span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <div className="shrink-0 px-5 py-3 border-b border-border flex items-center gap-4 bg-panel/20">
          <Eyebrow>Neighbourhood</Eyebrow>
          <label className="flex items-center gap-2 text-xs">
            <span className="text-muted uppercase tracking-[0.16em] text-[10px]">hops</span>
            <select
              value={hops}
              onChange={(e) => setHops(Number(e.target.value))}
              className="bg-bg border border-border rounded-sm text-xs px-1.5 py-0.5 focus:outline-none focus:border-fg"
            >
              {[1, 2, 3].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex-1 min-h-0 relative overflow-hidden bg-[radial-gradient(circle_at_1px_1px,_#e6e6e4_1px,_transparent_0)] bg-[length:24px_24px] bg-bg">
          {!centerId ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-6">
              <div className="font-display text-lg tracking-tightest">Pick a node to render</div>
              <p className="text-xs text-muted mt-1 max-w-[18rem]">
                Search on the left to ground the neighbourhood graph.
              </p>
            </div>
          ) : !nb ? (
            <div className="h-full flex items-center justify-center text-xs text-muted">
              Loading…
            </div>
          ) : nb.nodes.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <Empty />
            </div>
          ) : (
            <NeighbourhoodSvg
              data={nb}
              onNodeHover={setHover}
              onNodeClick={(n) => setCenterId(n.id)}
              onEdgeClick={setEdge}
            />
          )}

          {hover && (
            <div className="absolute top-3 right-3 max-w-xs bg-bg border border-border rounded-md p-3 shadow-card text-xs animate-fadeIn">
              <Eyebrow>{hover.type}</Eyebrow>
              <div className="font-display text-base tracking-tightest leading-tight mt-0.5">
                {hover.label}
              </div>
              {hoverAliases && hoverAliases.length > 0 && (
                <div className="mt-2 border-t border-border pt-2">
                  <Eyebrow className="mb-0.5">aliases</Eyebrow>
                  <div className="text-[11px] text-fg/85">{hoverAliases.join(', ')}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <Drawer
        open={!!edge}
        onClose={() => setEdge(null)}
        eyebrow={edge?.type}
        title={edge ? `weight ${edge.weight}` : ''}
        meta={edge ? `${edge.src}  →  ${edge.dst}` : undefined}
      >
        <Eyebrow className="mb-2">Evidence</Eyebrow>
        {!edgeData ? (
          <div className="text-xs text-muted">Loading…</div>
        ) : edgeData.chunks.length === 0 ? (
          <Empty compact />
        ) : (
          <ul className="space-y-3">
            {edgeData.chunks.map((c) => (
              <li key={c.id} className="border-l-2 border-border pl-3">
                <p className="text-sm whitespace-pre-wrap leading-relaxed text-fg/90">{c.text}</p>
                <div className="flex gap-3 mt-1 text-[10px] text-muted">
                  {c.url && (
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noreferrer"
                      className="underline hover:no-underline truncate"
                    >
                      {c.url}
                    </a>
                  )}
                  {c.score != null && (
                    <span className="font-mono">{c.score.toFixed(2)}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Drawer>
    </div>
  );
}

function NeighbourhoodSvg({
  data,
  onNodeHover,
  onNodeClick,
  onEdgeClick,
}: {
  data: GraphNeighbourhood;
  onNodeHover: (n: GraphNode | null) => void;
  onNodeClick: (n: GraphNode) => void;
  onEdgeClick: (e: GraphEdge) => void;
}) {
  const layout = useMemo(() => {
    const w = 800;
    const h = 480;
    const cx = w / 2;
    const cy = h / 2;
    const others = data.nodes.filter((n) => n.id !== data.center);
    const positions = new Map<string, { x: number; y: number }>();
    positions.set(data.center, { x: cx, y: cy });
    const ring1 = Math.min(others.length, 16);
    const ring2 = others.length - ring1;
    others.slice(0, ring1).forEach((n, i) => {
      const a = (i / ring1) * Math.PI * 2 - Math.PI / 2;
      positions.set(n.id, { x: cx + Math.cos(a) * 170, y: cy + Math.sin(a) * 170 });
    });
    others.slice(ring1).forEach((n, i) => {
      const a = (i / Math.max(ring2, 1)) * Math.PI * 2 + Math.PI / Math.max(ring2, 1);
      positions.set(n.id, { x: cx + Math.cos(a) * 235, y: cy + Math.sin(a) * 235 });
    });
    return { w, h, positions };
  }, [data]);

  const wMax = Math.max(...data.edges.map((e) => e.weight), 1);

  return (
    <svg viewBox={`0 0 ${layout.w} ${layout.h}`} className="w-full h-full">
      {/* faint orbital guides */}
      <circle
        cx={layout.w / 2}
        cy={layout.h / 2}
        r={170}
        fill="none"
        stroke="#eaeaea"
        strokeDasharray="2 4"
      />
      <circle
        cx={layout.w / 2}
        cy={layout.h / 2}
        r={235}
        fill="none"
        stroke="#eaeaea"
        strokeDasharray="2 4"
      />
      {data.edges.map((e, i) => {
        const a = layout.positions.get(e.src);
        const b = layout.positions.get(e.dst);
        if (!a || !b) return null;
        const sw = 0.5 + (e.weight / wMax) * 3.5;
        return (
          <g key={i} className="cursor-pointer">
            <title>
              {e.type} · weight {e.weight}
            </title>
            <line
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="#9a9a9a"
              strokeOpacity={0.55}
              strokeWidth={sw}
              onClick={() => onEdgeClick(e)}
              className="hover:stroke-[#0a0a0a]"
            />
          </g>
        );
      })}
      {data.nodes.map((n) => {
        const p = layout.positions.get(n.id)!;
        const isCenter = n.id === data.center;
        return (
          <g
            key={n.id}
            onMouseEnter={() => onNodeHover(n)}
            onMouseLeave={() => onNodeHover(null)}
            onClick={() => onNodeClick(n)}
            className="cursor-pointer"
          >
            <circle
              cx={p.x}
              cy={p.y}
              r={isCenter ? 11 : 6.5}
              fill={isCenter ? '#0a0a0a' : '#ffffff'}
              stroke="#0a0a0a"
              strokeWidth={1.4}
            />
            <text
              x={p.x}
              y={p.y - (isCenter ? 16 : 11)}
              textAnchor="middle"
              fontSize={isCenter ? 13 : 11}
              fontWeight={isCenter ? 600 : 400}
              fill="#0a0a0a"
              style={{ fontFamily: 'Fraunces, Georgia, serif', letterSpacing: '-0.02em' }}
            >
              {n.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Path ─────────────────────────────────────────────────────────────────

function PathTab() {
  const [src, setSrc] = useState('');
  const [dst, setDst] = useState('');
  const [path, setPath] = useState<GraphPath | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!src.trim() || !dst.trim()) return;
    setLoading(true);
    setErr(null);
    setPath(null);
    try {
      setPath(await graphApi.path(src.trim(), dst.trim()));
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-5 sm:px-8 py-6 max-w-3xl space-y-6">
      <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
        <NodePicker label="source" value={src} onChange={setSrc} />
        <NodePicker label="target" value={dst} onChange={setDst} />
        <Btn
          type="submit"
          variant="primary"
          disabled={loading || !src.trim() || !dst.trim()}
        >
          {loading ? 'Routing…' : 'Find path'}
        </Btn>
      </form>

      {err && (
        <div className="border border-red-200 bg-red-50 rounded-sm px-3 py-2 text-xs text-red-800">
          {err}
        </div>
      )}

      {!path ? null : path.nodes.length === 0 ? (
        <Empty title="no path" hint="No connection found between these nodes." />
      ) : (
        <ol className="border border-border rounded-md bg-bg overflow-hidden">
          {path.nodes.map((n, i) => (
            <li
              key={n.id}
              className="px-4 py-3 flex items-center gap-4 border-b border-border last:border-b-0"
            >
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted w-6">
                {String(i + 1).padStart(2, '0')}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-display text-base tracking-tightest leading-tight truncate">
                  {n.label}
                </div>
                <div className="text-[10px] uppercase tracking-[0.16em] text-muted">
                  {n.type}
                </div>
              </div>
              {path.edges[i] && (
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-muted">
                    {path.edges[i].type}
                  </div>
                  <div className="font-mono text-xs">
                    weight {path.edges[i].weight}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function NodePicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [hits, setHits] = useState<GraphSearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const tRef = useRef<number | null>(null);

  const onInput = (v: string) => {
    onChange(v);
    if (tRef.current) window.clearTimeout(tRef.current);
    tRef.current = window.setTimeout(() => {
      if (!v.trim()) {
        setHits([]);
        return;
      }
      graphApi.search(v.trim(), 8).then((r) => setHits(r.hits)).catch(() => setHits([]));
    }, 200);
  };

  return (
    <div className="relative">
      <Eyebrow className="mb-1">{label}</Eyebrow>
      <input
        value={value}
        onChange={(e) => onInput(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        className="w-full bg-bg border border-border rounded-sm px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:border-fg focus:ring-2 focus:ring-fg/10"
        placeholder="node id or label"
      />
      {open && hits.length > 0 && (
        <ul className="absolute left-0 right-0 top-full mt-1 bg-bg border border-border rounded-md shadow-card z-10 max-h-52 overflow-y-auto">
          {hits.map((h) => (
            <li key={h.id}>
              <button
                type="button"
                onMouseDown={() => onChange(h.id)}
                className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-panelHi"
              >
                <div className="truncate text-fg">{h.label}</div>
                <div className="text-[10px] text-muted font-mono truncate">
                  {h.id} · {h.type}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Resolution ───────────────────────────────────────────────────────────

function ResolutionTab() {
  const [pairs, setPairs] = useState<GraphResolutionPair[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = () =>
    graphApi
      .resolutionCandidates(50)
      .then((r) => setPairs(r.pairs))
      .catch(() => setPairs([]));
  useEffect(() => {
    void load();
  }, []);

  const decide = async (id: string, decision: 'merge' | 'skip' | 'never') => {
    setBusy(id);
    try {
      await graphApi.resolutionDecide(id, decision);
      setPairs((p) => p?.filter((x) => x.id !== id) ?? null);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="px-5 sm:px-8 py-5">
      {pairs == null ? (
        <div className="text-xs text-muted">Loading…</div>
      ) : pairs.length === 0 ? (
        <Empty title="no candidates" hint="The resolver has nothing to decide right now." />
      ) : (
        <ul className="space-y-2">
          {pairs.map((p) => (
            <li
              key={p.id}
              className="border border-border rounded-md bg-bg p-4 grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto] gap-4 items-center"
            >
              <NodeBlock node={p.a} />
              <div className="text-center">
                <div className="font-mono text-base text-fg">{p.score.toFixed(2)}</div>
                {p.reason && (
                  <div className="text-[10px] uppercase tracking-[0.16em] text-muted mt-0.5">
                    {p.reason}
                  </div>
                )}
              </div>
              <NodeBlock node={p.b} />
              <div className="flex gap-1 md:justify-end">
                <Btn
                  size="sm"
                  variant="primary"
                  disabled={busy === p.id}
                  onClick={() => void decide(p.id, 'merge')}
                >
                  Merge
                </Btn>
                <Btn size="sm" disabled={busy === p.id} onClick={() => void decide(p.id, 'skip')}>
                  Skip
                </Btn>
                <Btn
                  size="sm"
                  variant="danger"
                  disabled={busy === p.id}
                  onClick={() => void decide(p.id, 'never')}
                >
                  Never
                </Btn>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NodeBlock({ node }: { node: GraphNode }) {
  return (
    <div className="min-w-0">
      <Eyebrow className="mb-0.5">{node.type}</Eyebrow>
      <div className="font-display text-base tracking-tightest leading-tight truncate">
        {node.label}
      </div>
      {node.aliases && node.aliases.length > 0 && (
        <div className="text-[10px] text-muted truncate mt-0.5">
          aka {node.aliases.join(', ')}
        </div>
      )}
    </div>
  );
}

// ── Health ───────────────────────────────────────────────────────────────

function HealthTab() {
  const [stats, setStats] = useState<GraphStats | null>(null);
  const [events, setEvents] = useState<GraphMaintenanceEvent[] | null>(null);

  useEffect(() => {
    graphApi.stats().then(setStats).catch(() => setStats(null));
    graphApi
      .maintenanceEvents(100)
      .then((r) => setEvents(r.events))
      .catch(() => setEvents([]));
  }, []);

  return (
    <div className="px-5 sm:px-8 py-6 grid grid-cols-1 lg:grid-cols-2 gap-10">
      <section>
        <Eyebrow className="mb-2">Stats</Eyebrow>
        {!stats ? (
          <div className="text-xs text-muted">Loading…</div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 mb-5">
              <Stat label="nodes" value={stats.nodes_total} />
              <Stat label="edges" value={stats.edges_total} />
            </div>
            <SimpleBars title="By node type" rows={stats.by_type} />
            <SimpleBars title="By edge type" rows={stats.by_edge_type} />
          </>
        )}
      </section>

      <section>
        <Eyebrow className="mb-2">Maintenance timeline</Eyebrow>
        {events == null ? (
          <div className="text-xs text-muted">Loading…</div>
        ) : events.length === 0 ? (
          <Empty />
        ) : (
          <ul className="space-y-1.5">
            {events.map((e, i) => (
              <li
                key={i}
                className="flex items-baseline gap-3 text-xs border-b border-border pb-1.5"
              >
                <span className="font-mono text-muted w-20 shrink-0">{relTime(e.ts)}</span>
                <span className="text-[10px] uppercase tracking-[0.16em] text-muted w-28 shrink-0">
                  {e.kind}
                </span>
                <span className="truncate text-fg/85">{e.detail || ''}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-border rounded-md bg-bg p-3">
      <Eyebrow>{label}</Eyebrow>
      <div className="font-display text-3xl tracking-tightest leading-none mt-1">
        {value.toLocaleString()}
      </div>
    </div>
  );
}

function SimpleBars({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ type: string; count: number }>;
}) {
  if (rows.length === 0) return null;
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <div className="mb-5">
      <Eyebrow className="mb-2">{title}</Eyebrow>
      <ul className="space-y-1">
        {rows.map((r) => (
          <li key={r.type} className="flex items-center gap-3 text-xs">
            <span className="w-32 truncate font-mono text-fg/80">{r.type}</span>
            <div className="flex-1 bg-panel h-2 rounded-full overflow-hidden">
              <div className="h-full bg-fg" style={{ width: `${(r.count / max) * 100}%` }} />
            </div>
            <span className="font-mono text-[10px] text-muted w-14 text-right">
              {r.count.toLocaleString()}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
