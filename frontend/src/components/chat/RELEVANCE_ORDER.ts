import type { SearchSourceRelevance } from '../../api/types/SearchSourceRelevance';

export const RELEVANCE_ORDER: Record<SearchSourceRelevance, number> = {
  high: 0,
  medium: 1,
  low: 2,
};
