import { http } from '../../lib/http';
import type { SuggestedScrapeTarget } from '../types/SuggestedScrapeTarget';

export function getEnrichmentSuggestion(id: number) {
  return http.get(`api/enrichment/suggestions/${id}`).json<SuggestedScrapeTarget>();
}
