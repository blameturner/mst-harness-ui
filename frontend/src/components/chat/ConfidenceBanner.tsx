import type { SearchConfidence } from '../../api/types/SearchConfidence';

export function ConfidenceBanner({ confidence }: { confidence?: SearchConfidence }) {
  if (!confidence || confidence === 'high') return null;

  const labels: Record<Exclude<SearchConfidence, 'high'>, string> = {
    medium: 'Some related sources found — results may not fully cover this topic',
    low: 'Limited relevant sources — answer may rely on general knowledge',
    none: 'No search results found',
  };

  const styles: Record<Exclude<SearchConfidence, 'high'>, string> = {
    medium: 'border-amber-500/40 text-amber-600',
    low: 'border-amber-600/50 text-amber-600',
    none: 'border-border text-muted',
  };

  return (
    <div
      className={`mb-3 text-[11px] font-sans px-3 py-1.5 rounded-md border ${styles[confidence]}`}
    >
      {labels[confidence]}
    </div>
  );
}
