import { http } from '../../lib/http';

export function approveEnrichmentSuggestionsByParent(
  parentTarget: number,
  body: { enrichment_agent_id?: number },
) {
  return http
    .post('api/enrichment/suggestions/approve-by-parent', {
      json: { parent_target: parentTarget, ...body },
    })
    .json<{ ok: true }>();
}
