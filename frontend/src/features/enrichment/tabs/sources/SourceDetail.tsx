import { useEffect, useState } from 'react';
import type { EnrichmentAgent } from '../../../../api/types/EnrichmentAgent';
import type { EnrichmentLogEntry } from '../../../../api/types/EnrichmentLogEntry';
import type { ScrapeTarget } from '../../../../api/types/ScrapeTarget';
import { getEnrichmentSourceLog } from '../../../../api/enrichment/getEnrichmentSourceLog';
import { Select } from '../../../../components/Select';
import { LabeledCheckbox } from '../../../../components/LabeledCheckbox';
import { relTime } from '../../../../lib/utils/relTime';
import { LogRow } from '../log/LogRow';

export function SourceDetail({
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
    getEnrichmentSourceLog(source.id, 50)
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
