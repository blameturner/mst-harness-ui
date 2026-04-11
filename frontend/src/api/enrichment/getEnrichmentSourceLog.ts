import { http } from '../../lib/http';
import type { EnrichmentLogEntry } from '../types/EnrichmentLogEntry';

export function getEnrichmentSourceLog(id: number, limit = 50) {
  return http
    .get(`api/enrichment/sources/${id}/log`, { searchParams: { limit: String(limit) } })
    .json<{ entries: EnrichmentLogEntry[] }>();
}
