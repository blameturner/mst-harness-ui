import type { EnrichmentLogEntry } from '../../../../api/types/EnrichmentLogEntry';
import { relTime } from '../../../../lib/utils/relTime';

export function LogRow({ row }: { row: EnrichmentLogEntry }) {
  const highlight =
    row.event_type === 'deferred'
      ? 'bg-amber-50'
      : row.event_type === 'budget_exhausted'
        ? 'bg-red-50'
        : '';
  return (
    <div className={`py-2 flex items-start gap-3 text-xs ${highlight}`}>
      <span className="font-sans text-muted w-20 shrink-0">
        {relTime(row.created_at)}
      </span>
      <span className="font-sans text-muted w-40 shrink-0">
        {row.event_type}
      </span>
      <span className="font-sans text-muted w-48 shrink-0 truncate">
        {row.source_url ?? '—'}
      </span>
      <span className="font-sans text-muted w-16 text-right shrink-0">
        {row.tokens_used != null ? `${row.tokens_used}t` : ''}
      </span>
      <span className="font-sans text-muted w-14 text-right shrink-0">
        {row.duration_seconds != null ? `${row.duration_seconds.toFixed(1)}s` : ''}
      </span>
      <span className="flex-1 text-fg truncate">{row.message ?? ''}</span>
      {row.flags && row.flags.length > 0 && (
        <span className="flex flex-wrap gap-1 shrink-0 max-w-[200px] justify-end">
          {row.flags.map((flag) => (
            <span
              key={flag}
              className="text-[9px] uppercase px-1 py-0.5 rounded border border-border text-muted"
            >
              {flag}
            </span>
          ))}
        </span>
      )}
    </div>
  );
}
