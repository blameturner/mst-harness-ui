import { http } from '../../lib/http';

export function triggerEnrichmentAgent(id: number) {
  return http.post(`api/enrichment/agents/${id}/trigger`).json<{ status: string }>();
}
