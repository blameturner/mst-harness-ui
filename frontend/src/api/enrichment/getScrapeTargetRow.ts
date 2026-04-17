import { http } from '../../lib/http';
import type { EnrichmentRowResponse } from '../types/OpsDashboard';

export function getScrapeTargetRow(targetId: number | string) {
  return http.get(`api/enrichment/scrape-targets/${encodeURIComponent(String(targetId))}`).json<EnrichmentRowResponse>();
}

