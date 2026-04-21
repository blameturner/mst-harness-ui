import { useState } from 'react';
import type { SearchSource } from '../../api/types/SearchSource';
import type { SearchMode } from '../../api/types/SearchMode';
import type { IntentSourceLayout } from '../../api/types/IntentSourceLayout';
import { SourceCard } from './SourceCard';
import { sortedByRelevance } from './sortedByRelevance';

interface Props {
  sources: SearchSource[];
  layout: IntentSourceLayout;
  anchorPrefix?: string;
  searchMode?: SearchMode;
  queryCount?: number;
}

const SEARCH_MODE_LABEL: Record<SearchMode, string> = {
  standard: 'Standard',
  basic: 'Basic',
  disabled: 'Off',
};

function headerSuffix(mode: SearchMode | undefined, queries: number | undefined, sources: number): string {
  const parts: string[] = [];
  if (mode) parts.push(SEARCH_MODE_LABEL[mode]);
  if (queries && queries > 0) parts.push(`${queries} queries`);
  parts.push(`${sources} sources`);
  return parts.join(' · ');
}

export function SourcesPanel({ sources, layout, anchorPrefix, searchMode, queryCount }: Props) {
  const [open, setOpen] = useState(layout === 'expanded');
  const [showAll, setShowAll] = useState(false);

  if (layout === 'hidden') return null;
  if (sources.length === 0) return null;

  if (layout === 'collapsed' && !open) {
    return (
      <div className="mt-4 pt-3 border-t border-border">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-[10px] uppercase tracking-[0.16em] font-sans text-muted hover:text-fg transition-colors inline-flex items-center gap-1"
        >
          {headerSuffix(searchMode, queryCount, sources.length)}
          <span aria-hidden>▾</span>
        </button>
      </div>
    );
  }

  const sorted = sortedByRelevance(sources);
  const visible = showAll ? sorted : sorted.slice(0, 3);
  const hasMore = sources.length > 3;

  return (
    <div className="mt-4 pt-3 border-t border-border">
      <p className="text-[10px] uppercase tracking-[0.16em] font-sans text-muted mb-2">
        Sources · {headerSuffix(searchMode, queryCount, sources.length)}
      </p>
      <div className="space-y-1.5">
        {visible.map((src, i) => (
          <div
            key={src.url}
            id={anchorPrefix ? `${anchorPrefix}-${src.index ?? i + 1}` : undefined}
          >
            <SourceCard source={src} />
          </div>
        ))}
      </div>
      <div>
        {hasMore && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="mt-2 text-[10px] uppercase tracking-[0.14em] font-sans text-muted hover:text-fg transition-colors"
          >
            {showAll ? 'Show fewer' : `Show ${sources.length - 3} more`}
          </button>
        )}
        {layout === 'collapsed' && (
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setShowAll(false);
            }}
            className="ml-3 text-[10px] uppercase tracking-[0.14em] font-sans text-muted hover:text-fg transition-colors"
          >
            Hide
          </button>
        )}
      </div>
    </div>
  );
}
