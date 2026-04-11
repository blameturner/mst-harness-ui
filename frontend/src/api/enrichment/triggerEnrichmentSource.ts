import { http } from '../../lib/http';

export function triggerEnrichmentSource(id: number) {
  return http.post(`api/enrichment/sources/${id}/trigger`).json<{ status: string }>();
}
