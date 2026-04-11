import { http } from '../../lib/http';
import type { ScrapeTarget } from '../types/ScrapeTarget';
import type { EnrichmentCategory } from '../types/EnrichmentCategory';

export function createEnrichmentSource(body: {
  name: string;
  url: string;
  category?: EnrichmentCategory;
  frequency_hours?: number;
  active?: boolean;
  enrichment_agent_id?: number | null;
  use_playwright?: boolean;
  playwright_fallback?: boolean;
}) {
  return http.post('api/enrichment/sources', { json: body }).json<ScrapeTarget>();
}
