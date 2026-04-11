import { http } from '../../lib/http';

export function rejectEnrichmentSuggestion(id: number) {
  return http.post(`api/enrichment/suggestions/${id}/reject`).json<{ ok: true }>();
}
