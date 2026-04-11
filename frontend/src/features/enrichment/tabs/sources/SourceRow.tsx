import type { ScrapeTarget } from '../../../../api/types/ScrapeTarget';
import { STALENESS_BACKOFF_CAP } from '../../../../api/constants/STALENESS_BACKOFF_CAP';
import { relTime } from '../../../../lib/utils/relTime';

export function SourceRow({
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
  const unchanged = source.consecutive_unchanged ?? 0;
  const showBar = unchanged > 0;
  const barPct = (Math.min(unchanged, STALENESS_BACKOFF_CAP) / STALENESS_BACKOFF_CAP) * 100;
  return (
    <tr className="border-b border-border hover:bg-panelHi">
      <td className={`py-2 ${indent ? 'pl-6' : ''}`}>
        {indent && <span className="text-muted mr-1">└</span>}
        <button
          onClick={() => onSelect(source)}
          title={source.discovered_from ?? undefined}
          className="underline hover:text-fg text-left"
        >
          {source.name}
        </button>
        {source.auto_crawled === true && (
          <span className="text-[9px] uppercase tracking-[0.12em] px-1 py-0.5 rounded border border-border text-muted ml-1.5">
            auto
          </span>
        )}
      </td>
      <td className="py-2 font-sans text-xs truncate max-w-[220px]">
        <a href={source.url} target="_blank" rel="noreferrer" className="underline">
          {source.url}
        </a>
      </td>
      <td className="py-2 font-sans text-xs">{source.category}</td>
      <td className="py-2 font-sans text-[10px] text-muted">
        {source.depth != null && source.depth > 0 ? source.depth : ''}
      </td>
      <td className="py-2 font-sans text-xs text-muted">
        {agentName(source.enrichment_agent_id) ?? '—'}
      </td>
      <td className="py-2 font-sans text-xs">{source.frequency_hours}h</td>
      <td className="py-2 font-sans text-xs text-muted">
        {source.use_playwright ? 'PW' : source.playwright_fallback ? 'PW-fb' : ''}
      </td>
      <td className="py-2 text-xs text-muted">
        <div>{relTime(source.last_scraped_at)}</div>
        {source.next_crawl_at && (
          <div className="text-[10px] text-muted">
            → {relTime(source.next_crawl_at)} · {unchanged}× unchanged
          </div>
        )}
        {showBar && (
          <div className="bg-fg/30 h-px mt-1" style={{ width: `${barPct}%` }} />
        )}
      </td>
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
