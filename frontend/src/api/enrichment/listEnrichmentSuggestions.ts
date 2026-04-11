import { http } from '../../lib/http';
import type { SuggestedScrapeTarget } from '../types/SuggestedScrapeTarget';

export function listEnrichmentSuggestions(status?: string) {
  const searchParams: Record<string, string> = {};
  if (status) searchParams.status = status;
  return http
    .get('api/enrichment/suggestions', { searchParams })
    .json<{ suggestions: SuggestedScrapeTarget[] }>();
}
