import type { SearchSource } from '../../api/types/SearchSource';
import { CONTENT_TYPE_ACCEPT } from '../../api/constants/CONTENT_TYPE_ACCEPT';
import { RELEVANCE_COLORS } from './RELEVANCE_COLORS';

export function SourceCard({ source }: { source: SearchSource }) {
  const dimmed =
    source.content_type !== undefined &&
    !(CONTENT_TYPE_ACCEPT as readonly string[]).includes(source.content_type);

  const outerClass = `block rounded-md border border-border bg-bg/60 px-2.5 py-1.5 hover:border-fg/40 transition-colors group${
    dimmed ? ' opacity-60' : ''
  }`;

  const relClass = RELEVANCE_COLORS[source.relevance] ?? RELEVANCE_COLORS.unknown;

  return (
    <a href={source.url} target="_blank" rel="noreferrer noopener" className={outerClass}>
      <div className="min-w-0">
        <p className="text-[12px] font-medium leading-snug truncate group-hover:underline underline-offset-2 decoration-border">
          {source.title}
        </p>
        {source.snippet && (
          <p className="text-[10px] text-muted leading-tight line-clamp-1 mt-0.5">
            {source.snippet}
          </p>
        )}
        <div className="flex items-center gap-1 mt-1">
          <span
            className={`text-[8px] uppercase tracking-[0.1em] font-sans px-1 py-0.5 rounded border ${relClass}`}
          >
            {source.relevance}
          </span>
          <span className="text-[8px] uppercase tracking-[0.1em] font-sans px-1 py-0.5 rounded border border-border text-muted">
            {source.source_type.replace(/_/g, ' ')}
          </span>
          {source.content_type && (
            <span className="text-[8px] uppercase tracking-[0.1em] font-sans px-1 py-0.5 rounded border border-border text-muted">
              {source.content_type}
            </span>
          )}
        </div>
      </div>
    </a>
  );
}
