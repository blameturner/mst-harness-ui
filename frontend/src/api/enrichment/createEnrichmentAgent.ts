import { http } from '../../lib/http';
import type { EnrichmentAgent } from '../types/EnrichmentAgent';
import type { EnrichmentAgentCreateBody } from '../types/EnrichmentAgentCreateBody';

export function createEnrichmentAgent(body: EnrichmentAgentCreateBody) {
  return http.post('api/enrichment/agents', { json: body }).json<EnrichmentAgent>();
}
