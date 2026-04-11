import { http } from '../../lib/http';

export function approveEnrichmentSuggestion(id: number, body?: { enrichment_agent_id?: number }) {
  return http
    .post(`api/enrichment/suggestions/${id}/approve`, { json: body ?? {} })
    .json<{ ok: true }>();
}
