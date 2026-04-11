import type { SearchStatus } from '../../api/types/SearchStatus';

interface Props {
  status: SearchStatus | undefined;
}

const BASE =
  'mb-3 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] font-sans px-2 py-0.5 rounded-full border';

const variants: Record<string, { tone: string; label: string; caret?: boolean }> = {
  failed:     { tone: 'border-amber-600/40 text-amber-400 bg-amber-500/10', label: "Couldn't find anything specific" },
  no_results: { tone: 'border-border text-muted bg-bg',                     label: 'No results' },
  error:      { tone: 'border-red-600/40 text-red-400 bg-red-500/10',       label: 'Search failed' },
  deferred:   { tone: 'border-sky-600/40 text-sky-400 bg-sky-500/10',       label: 'Enriching…', caret: true },
};

export function SearchStatusBadge({ status }: Props) {
  const variant = variants[status ?? ''];
  if (!variant) return null;

  return (
    <div className={`${BASE} ${variant.tone}`}>
      <span>{variant.label}</span>
      {variant.caret && <span className="caret" />}
    </div>
  );
}
