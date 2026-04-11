import { http } from '../../lib/http';

export function flushEnrichmentSource(id: number) {
  return http.post(`api/enrichment/sources/${id}/flush`).json<{ ok: true; note?: string }>();
}
