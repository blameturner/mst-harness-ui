import { http } from '../../lib/http';
import type { EnrichmentAgent } from '../types/EnrichmentAgent';
import type { EnrichmentAgentCreateBody } from '../types/EnrichmentAgentCreateBody';

export function updateEnrichmentAgent(
  id: number,
  body: Partial<EnrichmentAgentCreateBody & { active: boolean }>,
) {
  return http.patch(`api/enrichment/agents/${id}`, { json: body }).json<EnrichmentAgent>();
}
