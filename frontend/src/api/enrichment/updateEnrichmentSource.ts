import { http } from '../../lib/http';
import type { ScrapeTarget } from '../types/ScrapeTarget';

export function updateEnrichmentSource(id: number, body: Partial<ScrapeTarget>) {
  return http.patch(`api/enrichment/sources/${id}`, { json: body }).json<ScrapeTarget>();
}
