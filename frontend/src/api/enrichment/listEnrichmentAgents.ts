import { http } from '../../lib/http';
import type { EnrichmentAgent } from '../types/EnrichmentAgent';

export function listEnrichmentAgents() {
  return http.get('api/enrichment/agents').json<{ agents: EnrichmentAgent[] }>();
}
