import { http } from '../../lib/http';
import type { EnrichmentAgentStatus } from '../types/EnrichmentAgentStatus';

export function getEnrichmentAgentStatus(id: number) {
  return http.get(`api/enrichment/agents/${id}/status`).json<EnrichmentAgentStatus>();
}
