import { harnessClient } from '../client.js';
import { HARNESS_ENRICHMENT_TIMEOUT_MS } from '../../../constants/timeouts/HARNESS_ENRICHMENT_TIMEOUT_MS.js';

export function patchEnrichmentSuggestion(suggestionId: number, body: unknown): Promise<Response> {
  return harnessClient.patch(`/enrichment/suggestions/${suggestionId}`, body, HARNESS_ENRICHMENT_TIMEOUT_MS);
}
