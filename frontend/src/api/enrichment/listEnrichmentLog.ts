import { http } from '../../lib/http';
import type { EnrichmentLogEntry } from '../types/EnrichmentLogEntry';

export function listEnrichmentLog(params?: { limit?: number }) {
  const searchParams: Record<string, string> = {};
  if (params?.limit != null) searchParams.limit = String(params.limit);
  return http
    .get('api/enrichment/log', { searchParams })
    .json<{ entries: EnrichmentLogEntry[] }>();
}
