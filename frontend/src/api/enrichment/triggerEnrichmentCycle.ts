import { http } from '../../lib/http';

export function triggerEnrichmentCycle() {
  return http.post('api/enrichment/trigger').json<{ status: string }>();
}
