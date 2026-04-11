import { http } from '../../lib/http';

export function deleteEnrichmentSource(id: number) {
  return http.delete(`api/enrichment/sources/${id}`).json<{ ok: true }>();
}
