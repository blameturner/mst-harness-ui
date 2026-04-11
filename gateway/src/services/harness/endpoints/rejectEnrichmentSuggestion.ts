import { harnessClient } from '../client.js';
import { HARNESS_ENRICHMENT_TIMEOUT_MS } from '../../../constants/timeouts/HARNESS_ENRICHMENT_TIMEOUT_MS.js';

export function rejectEnrichmentSuggestion(suggestionId: number): Promise<Response> {
  return harnessClient.post(`/enrichment/suggestions/${suggestionId}/reject`, {}, HARNESS_ENRICHMENT_TIMEOUT_MS);
}
