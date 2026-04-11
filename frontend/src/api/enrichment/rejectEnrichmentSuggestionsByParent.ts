import { http } from '../../lib/http';

export function rejectEnrichmentSuggestionsByParent(parentTarget: number) {
  return http
    .post('api/enrichment/suggestions/reject-by-parent', {
      json: { parent_target: parentTarget },
    })
    .json<{ ok: true }>();
}
