import { useState } from 'react';
import type { EnrichmentAgent } from '../../../../api/types/EnrichmentAgent';
import type { EnrichmentAgentStatus } from '../../../../api/types/EnrichmentAgentStatus';
import type { ScrapeTarget } from '../../../../api/types/ScrapeTarget';
import { Select } from '../../../../components/Select';
import { relTime } from '../../../../lib/utils/relTime';

export function AgentDetail({
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
