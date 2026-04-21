import type { SearchSource } from '../../api/types/SearchSource';
import { RELEVANCE_ORDER } from './RELEVANCE_ORDER';

export function sortedByRelevance(sources: SearchSource[]): SearchSource[] {
  return [...sources].sort(
    (a, b) => RELEVANCE_ORDER[a.relevance] - RELEVANCE_ORDER[b.relevance],
  );
}
