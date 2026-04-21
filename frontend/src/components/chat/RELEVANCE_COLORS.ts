import type { SearchSourceRelevance } from '../../api/types/SearchSourceRelevance';

export const RELEVANCE_COLORS: Record<SearchSourceRelevance, string> = {
  high: 'bg-green-600/15 text-green-700 border-green-600/30',
  medium: 'bg-amber-500/15 text-amber-700 border-amber-500/30',
  low: 'bg-border/60 text-muted border-border',
};
