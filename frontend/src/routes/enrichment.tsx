import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import {
  api,
  ENRICHMENT_CATEGORIES,
  ENRICHMENT_EVENT_TYPES,
  type EnrichmentAgent,
  type EnrichmentAgentStatus,
  type EnrichmentCategory,
  type EnrichmentEventType,
  type EnrichmentLogEntry,
  type ScrapeTarget,
  type SchedulerStatus,
  type SuggestedScrapeTarget,
} from '../lib/api';
import { authClient } from '../lib/auth-client';
import { Select } from '../components/Select';

type Tab = 'sources' | 'suggestions' | 'log' | 'agents';

function relTime(value: string | number | null): string {
  if (value == null) return '—';
  let t: number;
  if (typeof value === 'number') {
    // Unix timestamp — could be seconds or milliseconds
    t = value < 1e12 ? value * 1000 : value;
  } else {
    // Numeric string (unix timestamp) vs ISO string
    const num = Number(value);
    if (!Number.isNaN(num) && /^\d+$/.test(value.trim())) {
      t = num < 1e12 ? num * 1000 : num;
    } else {
      t = new Date(value).getTime();
    }
  }
  if (Number.isNaN(t)) return String(value);
  const diff = Date.now() - t;
  if (diff < 0) {
    // Future date — show "in X"
    const s = Math.round(-diff / 1000);
    if (s < 60) return `in ${s}s`;
    const m = Math.round(s / 60);
    if (m < 60) return `in ${m}m`;
    const h = Math.round(m / 60);
    return `in ${h}h`;
  }
  const s = Math.round(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

/** Exported so the harness page can embed it inline */
export function EnrichmentContent() {
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
    { id: 'agents', label: 'Agents' },
    { id: 'suggestions', label: 'Suggestions' },
    { id: 'log', label: 'Log' },
  ];

  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 border-b border-border px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <StatusBadge status={status} />
        </div>
        <button
          onClick={triggerCycle}
          disabled={triggering}
          className="text-[11px] uppercase tracking-[0.18em] font-sans border border-fg px-3 py-2 hover:bg-fg hover:text-bg transition-colors disabled:opacity-50"
        >
          {triggering ? 'triggering…' : 'run cycle now'}
        </button>
      </div>

      {banner && (
        <div className="shrink-0 px-8 py-3 bg-panel border-b border-border text-sm text-muted font-sans">
          {banner}
        </div>
      )}

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

      <main className="flex-1 min-h-0 overflow-y-auto px-8 py-6">
        {tab === 'sources' && <SourcesTab />}
        {tab === 'agents' && <AgentsTab />}
        {tab === 'suggestions' && <SuggestionsTab />}
        {tab === 'log' && <LogTab />}
      </main>
    </div>
  );
}

function EnrichmentPage() {
  return (
    <div className="min-h-full bg-bg text-fg font-sans">
      <header className="border-b border-border px-8 py-5 flex items-center justify-between">
        <div className="flex items-baseline gap-6">
          <Link to="/chat" className="text-xs uppercase tracking-[0.2em] text-muted font-sans">
            ← back
          </Link>
          <h1 className="font-display text-2xl tracking-tightest">Enrichment</h1>
        </div>
      </header>
      <EnrichmentContent />
    </div>
  );
}

function StatusBadge({ status }: { status: SchedulerStatus | null }) {
  if (!status) {
    return (
      <span className="text-[10px] uppercase tracking-[0.18em] font-sans text-muted">
        scheduler: unknown
      </span>
    );
  }
  return (
    <span className="text-[10px] uppercase tracking-[0.18em] font-sans text-muted">
      <span className={status.running ? 'text-fg' : 'text-muted'}>
        {status.running ? '● running' : '○ idle'}
      </span>
      {' · '}
      {status.sources_due} due
      {status.next_run && ` · next ${relTime(status.next_run)}`}
      {status.last_run && ` · last ${relTime(status.last_run.finished_at)}`}
    </span>
  );
}

function SourceRow({
  source,
  indent,
  agentName,
  onSelect,
  onToggleActive,
  onTrigger,
  onFlush,
  onRemove,
}: {
  source: ScrapeTarget;
  indent: boolean;
  agentName: (id: number | null) => string | null;
  onSelect: (s: ScrapeTarget) => void;
  onToggleActive: (s: ScrapeTarget) => void;
  onTrigger: (id: number) => void;
  onFlush: (id: number) => void;
  onRemove: (id: number) => void;
}) {
  return (
    <tr className="border-b border-border hover:bg-panelHi">
      <td className={`py-2 ${indent ? 'pl-6' : ''}`}>
        {indent && <span className="text-muted mr-1">└</span>}
        <button
          onClick={() => onSelect(source)}
          className="underline hover:text-fg text-left"
        >
          {source.name}
        </button>
      </td>
      <td className="py-2 font-sans text-xs truncate max-w-[220px]">
        <a href={source.url} target="_blank" rel="noreferrer" className="underline">
          {source.url}
        </a>
      </td>
      <td className="py-2 font-sans text-xs">{source.category}</td>
      <td className="py-2 font-sans text-xs text-muted">
        {agentName(source.enrichment_agent_id) ?? '—'}
      </td>
      <td className="py-2 font-sans text-xs">{source.frequency_hours}h</td>
      <td className="py-2 font-sans text-xs text-muted">
        {source.use_playwright ? 'PW' : source.playwright_fallback ? 'PW-fb' : ''}
      </td>
      <td className="py-2 text-xs text-muted">{relTime(source.last_scraped_at)}</td>
      <td className="py-2 text-xs">
        {source.status ?? '—'}
        {!source.active && <span className="text-muted"> (inactive)</span>}
      </td>
      <td className="py-2 text-right font-sans text-xs">{source.chunk_count}</td>
      <td className="py-2 text-right">
        <div className="flex gap-2 justify-end text-[10px] uppercase tracking-[0.14em] font-sans">
          <button onClick={() => onToggleActive(source)} className="hover:text-fg text-muted">
            {source.active ? 'disable' : 'enable'}
          </button>
          <button onClick={() => onTrigger(source.id)} className="hover:text-fg text-muted">
            scrape
          </button>
          <button onClick={() => onFlush(source.id)} className="hover:text-fg text-muted">
            flush
          </button>
          <button onClick={() => onRemove(source.id)} className="hover:text-red-700 text-muted">
            delete
          </button>
        </div>
      </td>
    </tr>
  );
}

function SourcesTree({
  sources,
  agentName,
  onSelect,
  onToggleActive,
  onTrigger,
  onFlush,
  onRemove,
}: {
  sources: ScrapeTarget[];
  agentName: (id: number | null) => string | null;
  onSelect: (s: ScrapeTarget) => void;
  onToggleActive: (s: ScrapeTarget) => void;
  onTrigger: (id: number) => void;
  onFlush: (id: number) => void;
  onRemove: (id: number) => void;
}) {
  // Build a map of parent_id -> children
  const childrenByParent = new Map<number, ScrapeTarget[]>();
  const rootSources: ScrapeTarget[] = [];

  for (const s of sources) {
    if (s.parent_target != null) {
      const list = childrenByParent.get(s.parent_target);
      if (list) list.push(s);
      else childrenByParent.set(s.parent_target, [s]);
    } else {
      rootSources.push(s);
    }
  }

  const rows: { source: ScrapeTarget; indent: boolean }[] = [];
  for (const root of rootSources) {
    rows.push({ source: root, indent: false });
    const children = childrenByParent.get(root.id);
    if (children) {
      for (const child of children) {
        rows.push({ source: child, indent: true });
      }
    }
  }
  // Orphan children whose parent isn't in the list
  for (const s of sources) {
    if (s.parent_target != null && !rootSources.some((r) => r.id === s.parent_target)) {
      if (!rows.some((r) => r.source.id === s.id)) {
        rows.push({ source: s, indent: true });
      }
    }
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-[10px] uppercase tracking-[0.16em] text-muted font-sans border-b border-border">
          <th className="text-left py-2">name</th>
          <th className="text-left py-2">url</th>
          <th className="text-left py-2">category</th>
          <th className="text-left py-2">agent</th>
          <th className="text-left py-2">freq</th>
          <th className="text-left py-2">pw</th>
          <th className="text-left py-2">last scraped</th>
          <th className="text-left py-2">status</th>
          <th className="text-right py-2">chunks</th>
          <th className="text-right py-2">actions</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ source, indent }) => (
          <SourceRow
            key={source.id}
            source={source}
            indent={indent}
            agentName={agentName}
            onSelect={onSelect}
            onToggleActive={onToggleActive}
            onTrigger={onTrigger}
            onFlush={onFlush}
            onRemove={onRemove}
          />
        ))}
      </tbody>
    </table>
  );
}

function SourcesTab() {
  const [sources, setSources] = useState<ScrapeTarget[]>([]);
  const [agents, setAgents] = useState<EnrichmentAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<ScrapeTarget | null>(null);
  const [form, setForm] = useState({
    name: '',
    url: '',
    category: 'documentation' as EnrichmentCategory,
    frequency_hours: 24,
    enrichment_agent_id: null as number | null,
    use_playwright: false,
    playwright_fallback: false,
  });

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [srcRes, agRes] = await Promise.all([
        api.enrichment.sources(),
        api.enrichment.agents(),
      ]);
      setSources(srcRes.sources);
      setAgents(agRes.agents ?? []);
      // Refresh selected if open
      if (selected) {
        const updated = srcRes.sources.find((s) => s.id === selected.id);
        if (updated) setSelected(updated);
        else setSelected(null);
      }
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
      setForm({ name: '', url: '', category: 'documentation', frequency_hours: 24, enrichment_agent_id: null, use_playwright: false, playwright_fallback: false });
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
      if (selected?.id === id) setSelected(null);
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function assignAgent(sourceId: number, agentId: number | null) {
    try {
      await api.enrichment.updateSource(sourceId, { enrichment_agent_id: agentId });
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function updateSource(sourceId: number, patch: Partial<ScrapeTarget>) {
    try {
      await api.enrichment.updateSource(sourceId, patch);
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const agentName = (id: number | null) => {
    if (id == null) return null;
    return agents.find((a) => a.Id === id)?.name ?? null;
  };

  if (selected) {
    return (
      <SourceDetail
        source={selected}
        agents={agents}
        agentName={agentName}
        onBack={() => setSelected(null)}
        onAssignAgent={(agentId) => assignAgent(selected.id, agentId)}
        onUpdate={(patch) => updateSource(selected.id, patch)}
        onToggleActive={() => toggleActive(selected)}
        onTrigger={() => triggerNow(selected.id)}
        onFlush={() => flushChunks(selected.id)}
        onDelete={() => remove(selected.id)}
      />
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-display text-xl">Sources</h2>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="text-[11px] uppercase tracking-[0.18em] font-sans border border-fg px-3 py-2 hover:bg-fg hover:text-bg transition-colors"
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
          <div>
            <span className="block text-[10px] uppercase tracking-[0.16em] text-muted mb-1.5 font-sans">
              Agent
            </span>
            <Select
              value={form.enrichment_agent_id == null ? '' : String(form.enrichment_agent_id)}
              onChange={(v) => setForm({ ...form, enrichment_agent_id: v === '' ? null : Number(v) })}
              placeholder="none"
              options={[
                { value: '', label: 'None' },
                ...agents.map((a) => ({ value: String(a.Id), label: a.name })),
              ]}
              position="below"
            />
          </div>
          <div className="col-span-2 flex items-center gap-6">
            <LabeledCheckbox
              label="Use Playwright"
              checked={form.use_playwright}
              onChange={(v) => setForm({ ...form, use_playwright: v })}
            />
            <LabeledCheckbox
              label="Playwright fallback"
              checked={form.playwright_fallback}
              onChange={(v) => setForm({ ...form, playwright_fallback: v })}
            />
          </div>
          <div className="col-span-2 flex justify-end">
            <button
              type="submit"
              className="text-[11px] uppercase tracking-[0.18em] font-sans border border-fg px-4 py-2 hover:bg-fg hover:text-bg"
            >
              create
            </button>
          </div>
        </form>
      )}

      {error && <div className="text-xs font-sans text-red-700 mb-3">{error}</div>}
      {loading ? (
        <div className="text-sm text-muted">Loading…</div>
      ) : sources.length === 0 ? (
        <div className="text-sm text-muted font-sans">No sources yet.</div>
      ) : (
        <SourcesTree
          sources={sources}
          agentName={agentName}
          onSelect={setSelected}
          onToggleActive={toggleActive}
          onTrigger={triggerNow}
          onFlush={flushChunks}
          onRemove={remove}
        />
      )}
    </div>
  );
}

function SourceDetail({
  source,
  agents,
  agentName,
  onBack,
  onAssignAgent,
  onUpdate,
  onToggleActive,
  onTrigger,
  onFlush,
  onDelete,
}: {
  source: ScrapeTarget;
  agents: EnrichmentAgent[];
  agentName: (id: number | null) => string | null;
  onBack: () => void;
  onAssignAgent: (agentId: number | null) => void;
  onUpdate: (patch: Partial<ScrapeTarget>) => void;
  onToggleActive: () => void;
  onTrigger: () => void;
  onFlush: () => void;
  onDelete: () => void;
}) {
  const [history, setHistory] = useState<EnrichmentLogEntry[]>([]);
  const [histLoading, setHistLoading] = useState(true);

  useEffect(() => {
    setHistLoading(true);
    api.enrichment
      .sourceLog(source.id, 50)
      .then((r) => setHistory(r.entries ?? []))
      .catch(() => setHistory([]))
      .finally(() => setHistLoading(false));
  }, [source.id]);

  return (
    <div>
      <button
        onClick={onBack}
        className="text-xs uppercase tracking-[0.18em] text-muted font-sans mb-4 hover:text-fg"
      >
        ← back to sources
      </button>

      <div className="border border-border rounded-md p-5 bg-panel/20 mb-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="font-display text-xl mb-1">{source.name}</h2>
            <a
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-sans text-muted underline break-all"
            >
              {source.url}
            </a>
          </div>
          <div className="flex gap-2 text-[10px] uppercase tracking-[0.14em] font-sans shrink-0">
            <button onClick={onToggleActive} className="border border-border px-2 py-1 hover:bg-fg hover:text-bg hover:border-fg transition-colors">
              {source.active ? 'disable' : 'enable'}
            </button>
            <button onClick={onTrigger} className="border border-border px-2 py-1 hover:bg-fg hover:text-bg hover:border-fg transition-colors">
              scrape now
            </button>
            <button onClick={onFlush} className="border border-border px-2 py-1 hover:bg-fg hover:text-bg hover:border-fg transition-colors">
              flush
            </button>
            <button onClick={onDelete} className="border border-border px-2 py-1 hover:border-red-700 hover:text-red-700 transition-colors">
              delete
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-sans">
          <div>
            <span className="block text-[10px] uppercase tracking-[0.14em] text-muted mb-1">Category</span>
            <span>{source.category}</span>
          </div>
          <div>
            <span className="block text-[10px] uppercase tracking-[0.14em] text-muted mb-1">Frequency</span>
            <span>{source.frequency_hours}h</span>
          </div>
          <div>
            <span className="block text-[10px] uppercase tracking-[0.14em] text-muted mb-1">Last scraped</span>
            <span>{relTime(source.last_scraped_at)}</span>
          </div>
          <div>
            <span className="block text-[10px] uppercase tracking-[0.14em] text-muted mb-1">Status</span>
            <span>
              {source.status ?? '—'}
              {!source.active && <span className="text-muted"> (inactive)</span>}
            </span>
          </div>
          <div>
            <span className="block text-[10px] uppercase tracking-[0.14em] text-muted mb-1">Chunks</span>
            <span>{source.chunk_count}</span>
          </div>
          <div>
            <span className="block text-[10px] uppercase tracking-[0.14em] text-muted mb-1">Content hash</span>
            <span className="truncate block max-w-[200px]">{source.content_hash ?? '—'}</span>
          </div>
        </div>
      </div>

      {/* Agent assignment + Playwright settings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="border border-border rounded-md p-4 bg-panel/20">
          <h3 className="font-display text-base mb-3">Assigned agent</h3>
          <div className="flex items-center gap-4">
            <Select
              value={source.enrichment_agent_id == null ? '' : String(source.enrichment_agent_id)}
              onChange={(v) => onAssignAgent(v === '' ? null : Number(v))}
              placeholder="none"
              options={[
                { value: '', label: 'None (unassigned)' },
                ...agents.map((a) => ({ value: String(a.Id), label: a.name })),
              ]}
              position="below"
            />
            {source.enrichment_agent_id != null && (
              <span className="text-xs text-muted font-sans">
                Currently: {agentName(source.enrichment_agent_id) ?? `ID ${source.enrichment_agent_id}`}
              </span>
            )}
          </div>
        </div>

        <div className="border border-border rounded-md p-4 bg-panel/20">
          <h3 className="font-display text-base mb-3">Scraper settings</h3>
          <div className="flex flex-col gap-3">
            <LabeledCheckbox
              label="Use Playwright (skip httpx, always use browser)"
              checked={source.use_playwright}
              onChange={(v) => onUpdate({ use_playwright: v })}
            />
            <LabeledCheckbox
              label="Playwright fallback (try httpx first, fall back to browser)"
              checked={source.playwright_fallback}
              onChange={(v) => onUpdate({ playwright_fallback: v })}
            />
          </div>
        </div>
      </div>

      {/* Scrape history */}
      <div className="border border-border rounded-md p-4 bg-panel/20">
        <h3 className="font-display text-base mb-3">Scrape history</h3>
        {histLoading ? (
          <p className="text-sm text-muted">Loading history…</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-muted font-sans">No scrape events yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {history.map((r) => (
              <LogRow key={r.id} row={r} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface SuggestionGroup {
  parentId: number | null;
  parentName: string | null;
  parentUrl: string | null;
  items: SuggestedScrapeTarget[];
}

function groupSuggestions(
  items: SuggestedScrapeTarget[],
  sources: ScrapeTarget[],
): SuggestionGroup[] {
  const byParent = new Map<number | null, SuggestedScrapeTarget[]>();
  for (const s of items) {
    const key = s.parent_target;
    const list = byParent.get(key);
    if (list) list.push(s);
    else byParent.set(key, [s]);
  }

  const groups: SuggestionGroup[] = [];
  // Standalone / external first
  const standalone = byParent.get(null);
  if (standalone) {
    groups.push({ parentId: null, parentName: null, parentUrl: null, items: standalone });
    byParent.delete(null);
  }
  // Grouped by parent
  for (const [parentId, children] of byParent) {
    const parent = sources.find((src) => src.id === parentId);
    groups.push({
      parentId,
      parentName: parent?.name ?? `Source #${parentId}`,
      parentUrl: parent?.url ?? null,
      items: children,
    });
  }
  return groups;
}

function SuggestionsTab() {
  const [items, setItems] = useState<SuggestedScrapeTarget[]>([]);
  const [sources, setSources] = useState<ScrapeTarget[]>([]);
  const [agents, setAgents] = useState<EnrichmentAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [reviewing, setReviewing] = useState<number | null>(null);
  const [approveAgentId, setApproveAgentId] = useState<string>('');
  const [bulkReviewing, setBulkReviewing] = useState<number | null>(null);
  const [bulkAgentId, setBulkAgentId] = useState<string>('');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<number>>(new Set());

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [sugRes, agRes, srcRes] = await Promise.all([
        api.enrichment.suggestions(statusFilter),
        api.enrichment.agents(),
        api.enrichment.sources(),
      ]);
      setItems(sugRes.suggestions);
      setAgents(agRes.agents ?? []);
      setSources(srcRes.sources ?? []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [statusFilter]);

  async function approve(id: number) {
    try {
      const body: { enrichment_agent_id?: number } = {};
      if (approveAgentId) body.enrichment_agent_id = Number(approveAgentId);
      await api.enrichment.approveSuggestion(id, body);
      setReviewing(null);
      setApproveAgentId('');
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function reject(id: number) {
    try {
      await api.enrichment.rejectSuggestion(id);
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function bulkApprove(parentTarget: number) {
    try {
      const body: { enrichment_agent_id?: number } = {};
      if (bulkAgentId) body.enrichment_agent_id = Number(bulkAgentId);
      await api.enrichment.approveByParent(parentTarget, body);
      setBulkReviewing(null);
      setBulkAgentId('');
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function bulkReject(parentTarget: number) {
    try {
      await api.enrichment.rejectByParent(parentTarget);
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function toggleGroupCollapsed(parentId: number) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(parentId)) next.delete(parentId);
      else next.add(parentId);
      return next;
    });
  }

  const groups = useMemo(() => groupSuggestions(items, sources), [items, sources]);

  const statusTabs: { id: 'pending' | 'approved' | 'rejected'; label: string }[] = [
    { id: 'pending', label: 'Pending' },
    { id: 'approved', label: 'Approved' },
    { id: 'rejected', label: 'Rejected' },
  ];

  return (
    <div>
      <div className="flex gap-1 mb-4">
        {statusTabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setStatusFilter(t.id)}
            className={[
              'px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] font-sans border transition-colors',
              statusFilter === t.id
                ? 'border-fg bg-fg text-bg'
                : 'border-border text-muted hover:text-fg',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <div className="text-xs font-sans text-red-700 mb-3">{error}</div>}
      {loading ? (
        <div className="text-sm text-muted">Loading…</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-muted font-sans">No {statusFilter} suggestions.</div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.parentId ?? 'standalone'}>
              {/* Group header for parent-grouped suggestions */}
              {group.parentId != null && (
                <div className="flex items-center gap-3 mb-3">
                  <button
                    onClick={() => toggleGroupCollapsed(group.parentId!)}
                    className="text-[10px] font-sans text-muted hover:text-fg"
                  >
                    {collapsedGroups.has(group.parentId) ? '▶' : '▼'}
                  </button>
                  <h3 className="font-display text-base">
                    {group.parentName}
                  </h3>
                  <span className="text-[10px] uppercase tracking-[0.14em] font-sans bg-panel border border-border px-2 py-0.5">
                    {group.items.length} sub-page{group.items.length !== 1 ? 's' : ''} pending
                  </span>
                  {group.parentUrl && (
                    <a
                      href={group.parentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-sans text-muted underline truncate max-w-[300px]"
                    >
                      {group.parentUrl}
                    </a>
                  )}
                  {statusFilter === 'pending' && (
                    <>
                      {bulkReviewing === group.parentId ? (
                        <div className="flex items-center gap-2 ml-auto">
                          <Select
                            value={bulkAgentId}
                            onChange={setBulkAgentId}
                            placeholder="agent"
                            options={[
                              { value: '', label: 'None' },
                              ...agents.map((a) => ({ value: String(a.Id), label: a.name })),
                            ]}
                            position="below"
                          />
                          <button
                            onClick={() => bulkApprove(group.parentId!)}
                            className="text-[10px] uppercase tracking-[0.14em] font-sans border border-fg px-3 py-1 hover:bg-fg hover:text-bg"
                          >
                            confirm all
                          </button>
                          <button
                            onClick={() => { setBulkReviewing(null); setBulkAgentId(''); }}
                            className="text-[10px] uppercase tracking-[0.14em] font-sans text-muted"
                          >
                            cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 ml-auto">
                          <button
                            onClick={() => { setBulkReviewing(group.parentId!); setBulkAgentId(''); }}
                            className="text-[10px] uppercase tracking-[0.14em] font-sans border border-fg px-3 py-1 hover:bg-fg hover:text-bg"
                          >
                            approve all
                          </button>
                          <button
                            onClick={() => bulkReject(group.parentId!)}
                            className="text-[10px] uppercase tracking-[0.14em] font-sans border border-border px-3 py-1 hover:border-red-700 hover:text-red-700"
                          >
                            reject all
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
              {group.parentId == null && groups.length > 1 && (
                <h3 className="font-display text-base mb-3">Standalone</h3>
              )}

              {/* Suggestion cards — hidden when group is collapsed */}
              {(group.parentId == null || !collapsedGroups.has(group.parentId)) && (
                <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ${group.parentId != null ? 'ml-5' : ''}`}>
                  {group.items.map((s) => {
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
                          <span className="text-[10px] uppercase tracking-[0.14em] font-sans text-muted">
                            {s.confidence} · score {s.confidence_score}
                          </span>
                        </div>
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-sans text-muted underline break-all"
                        >
                          {s.url}
                        </a>
                        <div className="text-[10px] uppercase tracking-[0.14em] font-sans text-muted mt-2">
                          {s.category} · seen {s.times_suggested}×
                          {s.suggested_by_url && (
                            <span> · from {s.suggested_by_url}</span>
                          )}
                        </div>
                        {s.reason && <p className="text-sm text-fg mt-3">{s.reason}</p>}
                        {statusFilter === 'pending' && (
                          <>
                            {reviewing === s.id ? (
                              <div className="mt-4 space-y-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] uppercase tracking-[0.14em] font-sans text-muted">
                                    agent
                                  </span>
                                  <Select
                                    value={approveAgentId}
                                    onChange={setApproveAgentId}
                                    placeholder="none"
                                    options={[
                                      { value: '', label: 'None' },
                                      ...agents.map((a) => ({ value: String(a.Id), label: a.name })),
                                    ]}
                                    position="below"
                                  />
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => approve(s.id)}
                                    className="text-[10px] uppercase tracking-[0.14em] font-sans border border-fg px-3 py-1 hover:bg-fg hover:text-bg"
                                  >
                                    confirm
                                  </button>
                                  <button
                                    onClick={() => { setReviewing(null); setApproveAgentId(''); }}
                                    className="text-[10px] uppercase tracking-[0.14em] font-sans text-muted"
                                  >
                                    cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="mt-4 flex gap-2">
                                <button
                                  onClick={() => {
                                    setReviewing(s.id);
                                    setApproveAgentId('');
                                  }}
                                  className="text-[10px] uppercase tracking-[0.14em] font-sans border border-fg px-3 py-1 hover:bg-fg hover:text-bg"
                                >
                                  approve
                                </button>
                                <button
                                  onClick={() => reject(s.id)}
                                  className="text-[10px] uppercase tracking-[0.14em] font-sans border border-border px-3 py-1 hover:border-red-700 hover:text-red-700"
                                >
                                  reject
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LogTab() {
  const [entries, setEntries] = useState<EnrichmentLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvents, setSelectedEvents] = useState<EnrichmentEventType[]>([]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api.enrichment
      .log({ limit: 200 })
      .then((r) => setEntries(r.entries ?? []))
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (selectedEvents.length === 0) return entries;
    return entries.filter((e) => selectedEvents.includes(e.event_type));
  }, [entries, selectedEvents]);

  const grouped = useMemo(() => {
    const groups = new Map<string, EnrichmentLogEntry[]>();
    for (const e of filtered) {
      const key = e.cycle_id || 'uncycled';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(e);
    }
    return Array.from(groups.entries());
  }, [filtered]);

  function toggleEvent(ev: EnrichmentEventType) {
    setSelectedEvents((prev) =>
      prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev],
    );
  }

  return (
    <div>
      <div className="bg-panel border border-border p-4 mb-4">
        <div className="text-[10px] uppercase tracking-[0.14em] font-sans text-muted mb-2">
          event type filter
        </div>
        <div className="flex flex-wrap gap-2">
          {ENRICHMENT_EVENT_TYPES.map((ev) => (
            <button
              key={ev}
              onClick={() => toggleEvent(ev)}
              className={[
                'text-[10px] uppercase tracking-[0.14em] font-sans px-2 py-1 border',
                selectedEvents.includes(ev)
                  ? 'border-fg bg-fg text-bg'
                  : 'border-border text-muted hover:text-fg',
              ].join(' ')}
            >
              {ev}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="text-xs font-sans text-red-700 mb-3">{error}</div>}
      {loading ? (
        <div className="text-sm text-muted">Loading…</div>
      ) : grouped.length === 0 ? (
        <div className="text-sm text-muted font-sans">No log entries.</div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([cycleId, rows]) => {
            const tokens = rows.reduce((a, r) => a + (r.tokens_used ?? 0), 0);
            const counts: Record<string, number> = {};
            for (const r of rows) counts[r.event_type] = (counts[r.event_type] ?? 0) + 1;
            return (
              <div key={cycleId}>
                <div className="border-b border-fg pb-2 mb-2 flex justify-between items-baseline">
                  <span className="font-sans text-xs text-fg">cycle {cycleId}</span>
                  <span className="text-[10px] uppercase tracking-[0.14em] font-sans text-muted">
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

      <div className="mt-6 text-[10px] uppercase tracking-[0.14em] font-sans text-muted">
        {filtered.length} entries{selectedEvents.length > 0 && ` (${entries.length} total)`}
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
      <span className="font-sans text-muted w-40 shrink-0">
        {row.event_type}
      </span>
      <span className="font-sans text-muted w-48 shrink-0 truncate">
        {row.source_url ?? '—'}
      </span>
      <span className="flex-1 text-fg">{row.message ?? ''}</span>
      <span className="font-sans text-muted w-20 text-right shrink-0">
        {row.tokens_used != null ? `${row.tokens_used}t` : ''}
      </span>
      <span className="font-sans text-muted w-16 text-right shrink-0">
        {row.duration_seconds != null ? `${row.duration_seconds.toFixed(1)}s` : ''}
      </span>
    </div>
  );
}

function AgentsTab() {
  const [agents, setAgents] = useState<EnrichmentAgent[]>([]);
  const [sources, setSources] = useState<ScrapeTarget[]>([]);
  const [statuses, setStatuses] = useState<Record<number, EnrichmentAgentStatus>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<EnrichmentAgent | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    category: '',
    token_budget: 50000,
    cron_expression: '0 */6 * * *',
    timezone: 'Australia/Sydney',
  });
  const [saving, setSaving] = useState(false);
  const [triggering, setTriggering] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [agRes, srcRes] = await Promise.all([
        api.enrichment.agents(),
        api.enrichment.sources(),
      ]);
      setAgents(agRes.agents ?? []);
      setSources(srcRes.sources);
      const statusMap: Record<number, EnrichmentAgentStatus> = {};
      await Promise.all(
        (agRes.agents ?? []).map(async (a) => {
          try {
            statusMap[a.Id] = await api.enrichment.agentStatus(a.Id);
          } catch {}
        }),
      );
      setStatuses(statusMap);
      if (selected) {
        const updated = (agRes.agents ?? []).find((a) => a.Id === selected.Id);
        if (updated) setSelected(updated);
        else setSelected(null);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function create() {
    setSaving(true);
    try {
      await api.enrichment.createAgent(form);
      setShowForm(false);
      setForm({ name: '', description: '', category: '', token_budget: 50000, cron_expression: '0 */6 * * *', timezone: 'Australia/Sydney' });
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function toggle(agent: EnrichmentAgent) {
    try {
      await api.enrichment.updateAgent(agent.Id, { active: !agent.active });
      setAgents((as) => as.map((a) => (a.Id === agent.Id ? { ...a, active: !a.active } : a)));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function trigger(id: number) {
    setTriggering(id);
    try {
      await api.enrichment.triggerAgent(id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setTriggering(null);
    }
  }

  async function assignSourceToAgent(sourceId: number, agentId: number | null) {
    try {
      await api.enrichment.updateSource(sourceId, { enrichment_agent_id: agentId });
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (loading) return <p className="text-muted text-sm">Loading agents…</p>;
  if (error) return <p className="text-red-600 text-sm">{error}</p>;

  if (selected) {
    const agentSources = sources.filter((s) => s.enrichment_agent_id === selected.Id);
    const unassigned = sources.filter((s) => s.enrichment_agent_id == null || s.enrichment_agent_id !== selected.Id);
    const st = statuses[selected.Id];
    return (
      <AgentDetail
        agent={selected}
        status={st}
        agentSources={agentSources}
        unassignedSources={unassigned}
        onBack={() => setSelected(null)}
        onToggle={() => toggle(selected)}
        onTrigger={() => trigger(selected.Id)}
        onAssignSource={(srcId) => assignSourceToAgent(srcId, selected.Id)}
        onRemoveSource={(srcId) => assignSourceToAgent(srcId, null)}
        triggering={triggering === selected.Id}
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-muted text-xs font-sans">
          {agents.length} enrichment agent{agents.length !== 1 ? 's' : ''} configured
        </p>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="text-[11px] uppercase tracking-[0.18em] font-sans border border-fg px-3 py-1.5 hover:bg-fg hover:text-bg transition-colors"
        >
          {showForm ? 'Cancel' : '+ New agent'}
        </button>
      </div>

      {showForm && (
        <div className="border border-border rounded-md p-4 mb-6 space-y-3 bg-panel/30">
          <div className="grid grid-cols-2 gap-3">
            <LabeledInput label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
            <LabeledInput label="Category" value={form.category} onChange={(v) => setForm({ ...form, category: v })} />
          </div>
          <LabeledInput label="Description" value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
          <div className="grid grid-cols-3 gap-3">
            <LabeledInput label="Cron" value={form.cron_expression} onChange={(v) => setForm({ ...form, cron_expression: v })} required />
            <LabeledInput label="Timezone" value={form.timezone} onChange={(v) => setForm({ ...form, timezone: v })} />
            <LabeledInput label="Token budget" value={String(form.token_budget)} onChange={(v) => setForm({ ...form, token_budget: parseInt(v, 10) || 50000 })} />
          </div>
          <button
            onClick={() => void create()}
            disabled={saving || !form.name || !form.cron_expression}
            className="text-[11px] uppercase tracking-[0.18em] font-sans border border-fg px-4 py-2 hover:bg-fg hover:text-bg transition-colors disabled:opacity-50"
          >
            {saving ? 'Creating…' : 'Create agent'}
          </button>
        </div>
      )}

      {agents.length === 0 && !showForm ? (
        <p className="text-muted text-sm py-8 text-center">
          No enrichment agents yet. Create one to run topic-specific enrichment cycles on their own schedule.
        </p>
      ) : (
        <div className="space-y-3">
          {agents.map((agent) => {
            const st = statuses[agent.Id];
            const srcCount = sources.filter((s) => s.enrichment_agent_id === agent.Id).length;
            return (
              <div
                key={agent.Id}
                className={[
                  'border rounded-md p-4 transition-colors cursor-pointer',
                  agent.active ? 'border-border bg-panel/20 hover:bg-panel/40' : 'border-border/50 bg-panel/5 opacity-60 hover:opacity-80',
                ].join(' ')}
                onClick={() => setSelected(agent)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-display text-base tracking-tight font-medium underline">{agent.name}</h3>
                      {agent.category && (
                        <span className="text-[9px] uppercase tracking-[0.14em] font-sans px-1.5 py-0.5 rounded bg-panel border border-border text-muted">
                          {agent.category}
                        </span>
                      )}
                      <span className={`text-[9px] uppercase tracking-[0.14em] font-sans ${agent.active ? 'text-emerald-500' : 'text-muted'}`}>
                        {agent.active ? 'active' : 'paused'}
                      </span>
                    </div>
                    {agent.description && (
                      <p className="text-xs text-muted mb-2">{agent.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-[10px] uppercase tracking-[0.12em] font-sans text-muted">
                      <span>cron: {agent.cron_expression}</span>
                      <span>{agent.timezone}</span>
                      <span>{agent.token_budget.toLocaleString()} tokens</span>
                      <span>{srcCount} source{srcCount !== 1 ? 's' : ''}</span>
                      {st?.last_run && <span>last: {relTime(st.last_run.finished_at)}</span>}
                      {st?.next_run && <span>next: {relTime(st.next_run)}</span>}
                      {st != null && <span>{st.sources_due} due</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => void trigger(agent.Id)}
                      disabled={triggering === agent.Id}
                      className="text-[10px] uppercase tracking-[0.14em] font-sans border border-border px-2 py-1 hover:bg-fg hover:text-bg hover:border-fg transition-colors disabled:opacity-50"
                    >
                      {triggering === agent.Id ? '…' : 'Run now'}
                    </button>
                    <button
                      onClick={() => void toggle(agent)}
                      className="text-[10px] uppercase tracking-[0.14em] font-sans border border-border px-2 py-1 hover:bg-fg hover:text-bg hover:border-fg transition-colors"
                    >
                      {agent.active ? 'Pause' : 'Enable'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AgentDetail({
  agent,
  status,
  agentSources,
  unassignedSources,
  onBack,
  onToggle,
  onTrigger,
  onAssignSource,
  onRemoveSource,
  triggering,
}: {
  agent: EnrichmentAgent;
  status?: EnrichmentAgentStatus;
  agentSources: ScrapeTarget[];
  unassignedSources: ScrapeTarget[];
  onBack: () => void;
  onToggle: () => void;
  onTrigger: () => void;
  onAssignSource: (sourceId: number) => void;
  onRemoveSource: (sourceId: number) => void;
  triggering: boolean;
}) {
  const [addingSource, setAddingSource] = useState(false);
  const [sourceToAdd, setSourceToAdd] = useState('');

  return (
    <div>
      <button
        onClick={onBack}
        className="text-xs uppercase tracking-[0.18em] text-muted font-sans mb-4 hover:text-fg"
      >
        ← back to agents
      </button>

      <div className="border border-border rounded-md p-5 bg-panel/20 mb-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="font-display text-xl">{agent.name}</h2>
              {agent.category && (
                <span className="text-[9px] uppercase tracking-[0.14em] font-sans px-1.5 py-0.5 rounded bg-panel border border-border text-muted">
                  {agent.category}
                </span>
              )}
              <span className={`text-[9px] uppercase tracking-[0.14em] font-sans ${agent.active ? 'text-emerald-500' : 'text-muted'}`}>
                {agent.active ? 'active' : 'paused'}
              </span>
            </div>
            {agent.description && (
              <p className="text-sm text-muted mb-2">{agent.description}</p>
            )}
          </div>
          <div className="flex gap-2 text-[10px] uppercase tracking-[0.14em] font-sans shrink-0">
            <button
              onClick={onTrigger}
              disabled={triggering}
              className="border border-border px-2 py-1 hover:bg-fg hover:text-bg hover:border-fg transition-colors disabled:opacity-50"
            >
              {triggering ? '…' : 'Run now'}
            </button>
            <button
              onClick={onToggle}
              className="border border-border px-2 py-1 hover:bg-fg hover:text-bg hover:border-fg transition-colors"
            >
              {agent.active ? 'Pause' : 'Enable'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-sans">
          <div>
            <span className="block text-[10px] uppercase tracking-[0.14em] text-muted mb-1">Cron</span>
            <span>{agent.cron_expression}</span>
          </div>
          <div>
            <span className="block text-[10px] uppercase tracking-[0.14em] text-muted mb-1">Timezone</span>
            <span>{agent.timezone}</span>
          </div>
          <div>
            <span className="block text-[10px] uppercase tracking-[0.14em] text-muted mb-1">Token budget</span>
            <span>{agent.token_budget.toLocaleString()}</span>
          </div>
          {status?.last_run && (
            <div>
              <span className="block text-[10px] uppercase tracking-[0.14em] text-muted mb-1">Last run</span>
              <span>{relTime(status.last_run.finished_at)}</span>
            </div>
          )}
          {status?.next_run && (
            <div>
              <span className="block text-[10px] uppercase tracking-[0.14em] text-muted mb-1">Next run</span>
              <span>{relTime(status.next_run)}</span>
            </div>
          )}
          {status != null && (
            <div>
              <span className="block text-[10px] uppercase tracking-[0.14em] text-muted mb-1">Sources due</span>
              <span>{status.sources_due}</span>
            </div>
          )}
        </div>
      </div>

      {/* Assigned sources */}
      <div className="border border-border rounded-md p-4 bg-panel/20">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-base">
            Sources ({agentSources.length})
          </h3>
          <button
            onClick={() => setAddingSource((v) => !v)}
            className="text-[10px] uppercase tracking-[0.14em] font-sans border border-fg px-2 py-1 hover:bg-fg hover:text-bg transition-colors"
          >
            {addingSource ? 'Cancel' : '+ Add source'}
          </button>
        </div>

        {addingSource && unassignedSources.length > 0 && (
          <div className="flex items-center gap-3 mb-4 p-3 bg-panel border border-border rounded">
            <Select
              value={sourceToAdd}
              onChange={setSourceToAdd}
              placeholder="Select a source…"
              options={unassignedSources.map((s) => ({ value: String(s.id), label: `${s.name} (${s.url})` }))}
              position="below"
            />
            <button
              onClick={() => {
                if (sourceToAdd) {
                  onAssignSource(Number(sourceToAdd));
                  setSourceToAdd('');
                  setAddingSource(false);
                }
              }}
              disabled={!sourceToAdd}
              className="text-[10px] uppercase tracking-[0.14em] font-sans border border-fg px-3 py-1 hover:bg-fg hover:text-bg transition-colors disabled:opacity-50 shrink-0"
            >
              Assign
            </button>
          </div>
        )}
        {addingSource && unassignedSources.length === 0 && (
          <p className="text-xs text-muted font-sans mb-4">All sources are already assigned to an agent.</p>
        )}

        {agentSources.length === 0 ? (
          <p className="text-sm text-muted font-sans">No sources assigned to this agent yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.16em] text-muted font-sans border-b border-border">
                <th className="text-left py-2">name</th>
                <th className="text-left py-2">url</th>
                <th className="text-left py-2">category</th>
                <th className="text-left py-2">freq</th>
                <th className="text-left py-2">last scraped</th>
                <th className="text-left py-2">status</th>
                <th className="text-right py-2">chunks</th>
                <th className="text-right py-2"></th>
              </tr>
            </thead>
            <tbody>
              {agentSources.map((s) => (
                <tr key={s.id} className="border-b border-border hover:bg-panelHi">
                  <td className="py-2">{s.name}</td>
                  <td className="py-2 font-sans text-xs truncate max-w-[220px]">
                    <a href={s.url} target="_blank" rel="noreferrer" className="underline">
                      {s.url}
                    </a>
                  </td>
                  <td className="py-2 font-sans text-xs">{s.category}</td>
                  <td className="py-2 font-sans text-xs">{s.frequency_hours}h</td>
                  <td className="py-2 text-xs text-muted">{relTime(s.last_scraped_at)}</td>
                  <td className="py-2 text-xs">
                    {s.status ?? '—'}
                    {!s.active && <span className="text-muted"> (inactive)</span>}
                  </td>
                  <td className="py-2 text-right font-sans text-xs">{s.chunk_count}</td>
                  <td className="py-2 text-right">
                    <button
                      onClick={() => onRemoveSource(s.id)}
                      className="text-[10px] uppercase tracking-[0.14em] font-sans text-muted hover:text-red-700"
                    >
                      remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

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
      <span className="block text-[10px] uppercase tracking-[0.16em] text-muted mb-1.5 font-sans">
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
    <div className="block">
      <span className="block text-[10px] uppercase tracking-[0.16em] text-muted mb-1.5 font-sans">
        {label}
      </span>
      <Select
        value={value}
        onChange={(v) => onChange(v)}
        options={options.map((o) => ({ value: o, label: o }))}
        position="below"
      />
    </div>
  );
}

function LabeledCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-fg"
      />
      <span className="text-[10px] uppercase tracking-[0.14em] text-muted font-sans">
        {label}
      </span>
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
