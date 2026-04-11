import { harnessClient } from '../client.js';
import { HARNESS_ENRICHMENT_TIMEOUT_MS } from '../../../constants/timeouts/HARNESS_ENRICHMENT_TIMEOUT_MS.js';

export function getEnrichmentSuggestion(suggestionId: number): Promise<Response> {
  return harnessClient.get(`/enrichment/suggestions/${suggestionId}`, HARNESS_ENRICHMENT_TIMEOUT_MS);
}
