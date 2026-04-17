import { http } from '../../lib/http';
import type { EnrichmentRowResponse } from '../types/OpsDashboard';

export function getDiscoveryRow(rowId: number | string) {
  return http.get(`api/enrichment/discovery/${encodeURIComponent(String(rowId))}`).json<EnrichmentRowResponse>();
}

