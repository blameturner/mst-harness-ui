import { useEffect, useState } from 'react';
import type { EnrichmentAgent } from '../../../../api/types/EnrichmentAgent';
import type { EnrichmentCategory } from '../../../../api/types/EnrichmentCategory';
import type { ScrapeTarget } from '../../../../api/types/ScrapeTarget';
import { ENRICHMENT_CATEGORIES } from '../../../../api/constants/ENRICHMENT_CATEGORIES';
import { listEnrichmentSources } from '../../../../api/enrichment/listEnrichmentSources';
import { listEnrichmentAgents } from '../../../../api/enrichment/listEnrichmentAgents';
import { createEnrichmentSource } from '../../../../api/enrichment/createEnrichmentSource';
import { updateEnrichmentSource } from '../../../../api/enrichment/updateEnrichmentSource';
import { deleteEnrichmentSource } from '../../../../api/enrichment/deleteEnrichmentSource';
import { triggerEnrichmentSource } from '../../../../api/enrichment/triggerEnrichmentSource';
import { flushEnrichmentSource } from '../../../../api/enrichment/flushEnrichmentSource';
import { Select } from '../../../../components/Select';
import { LabeledInput } from '../../../../components/LabeledInput';
import { LabeledSelect } from '../../../../components/LabeledSelect';
import { LabeledCheckbox } from '../../../../components/LabeledCheckbox';
import { SourcesTree } from './SourcesTree';
import { SourceDetail } from './SourceDetail';

export function SourcesTab() {
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
        listEnrichmentSources(),
        listEnrichmentAgents(),
      ]);
      setSources(srcRes.sources);
      setAgents(agRes.agents ?? []);
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
      await createEnrichmentSource(form);
      setShowForm(false);
      setForm({ name: '', url: '', category: 'documentation', frequency_hours: 24, enrichment_agent_id: null, use_playwright: false, playwright_fallback: false });
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function toggleActive(s: ScrapeTarget) {
    try {
      await updateEnrichmentSource(s.id, { active: !s.active });
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function triggerNow(id: number) {
    try {
      await triggerEnrichmentSource(id);
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
      await flushEnrichmentSource(id);
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function remove(id: number) {
    if (!confirm('Deactivate this source?')) return;
    try {
      await deleteEnrichmentSource(id);
      if (selected?.id === id) setSelected(null);
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function assignAgent(sourceId: number, agentId: number | null) {
    try {
      await updateEnrichmentSource(sourceId, { enrichment_agent_id: agentId });
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function updateSource(sourceId: number, patch: Partial<ScrapeTarget>) {
    try {
      await updateEnrichmentSource(sourceId, patch);
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
