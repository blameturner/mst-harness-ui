import { useEffect, useState } from 'react';
import type { EnrichmentAgent } from '../../../../api/types/EnrichmentAgent';
import type { EnrichmentAgentStatus } from '../../../../api/types/EnrichmentAgentStatus';
import type { ScrapeTarget } from '../../../../api/types/ScrapeTarget';
import { listEnrichmentAgents } from '../../../../api/enrichment/listEnrichmentAgents';
import { listEnrichmentSources } from '../../../../api/enrichment/listEnrichmentSources';
import { createEnrichmentAgent } from '../../../../api/enrichment/createEnrichmentAgent';
import { updateEnrichmentAgent } from '../../../../api/enrichment/updateEnrichmentAgent';
import { triggerEnrichmentAgent } from '../../../../api/enrichment/triggerEnrichmentAgent';
import { getEnrichmentAgentStatus } from '../../../../api/enrichment/getEnrichmentAgentStatus';
import { updateEnrichmentSource } from '../../../../api/enrichment/updateEnrichmentSource';
import { LabeledInput } from '../../../../components/LabeledInput';
import { CronPicker, humaniseCron } from '../../../../components/CronPicker';
import { relTime } from '../../../../lib/utils/relTime';
import { AgentDetail } from './AgentDetail';

export function AgentsTab() {
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
        listEnrichmentAgents(),
        listEnrichmentSources(),
      ]);
      setAgents(agRes.agents ?? []);
      setSources(srcRes.sources);
      const statusMap: Record<number, EnrichmentAgentStatus> = {};
      await Promise.all(
        (agRes.agents ?? []).map(async (a) => {
          try {
            statusMap[a.Id] = await getEnrichmentAgentStatus(a.Id);
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
      await createEnrichmentAgent(form);
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
      await updateEnrichmentAgent(agent.Id, { active: !agent.active });
      setAgents((as) => as.map((a) => (a.Id === agent.Id ? { ...a, active: !a.active } : a)));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function trigger(id: number) {
    setTriggering(id);
    try {
      await triggerEnrichmentAgent(id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setTriggering(null);
    }
  }

  async function assignSourceToAgent(sourceId: number, agentId: number | null) {
    try {
      await updateEnrichmentSource(sourceId, { enrichment_agent_id: agentId });
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
        onUpdated={(updated) => {
          setSelected(updated);
          setAgents((as) => as.map((a) => (a.Id === updated.Id ? updated : a)));
        }}
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
          <LabeledInput label="Token budget" value={String(form.token_budget)} onChange={(v) => setForm({ ...form, token_budget: parseInt(v, 10) || 50000 })} />
          <CronPicker
            value={form.cron_expression}
            onChange={(v) => setForm({ ...form, cron_expression: v })}
            timezone={form.timezone}
            onTimezoneChange={(v) => setForm({ ...form, timezone: v })}
          />
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
                      <span title={agent.cron_expression}>{humaniseCron(agent.cron_expression)}</span>
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
