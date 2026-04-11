import { http } from '../../lib/http';
import type { ScrapeTarget } from '../types/ScrapeTarget';

export function getEnrichmentSource(id: number) {
  return http.get(`api/enrichment/sources/${id}`).json<ScrapeTarget>();
}
