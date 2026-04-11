import type { SuggestedScrapeTarget } from '../../../api/types/SuggestedScrapeTarget';

export interface SuggestionGroup {
  parentId: number | null;
  parentName: string | null;
  parentUrl: string | null;
  items: SuggestedScrapeTarget[];
}
