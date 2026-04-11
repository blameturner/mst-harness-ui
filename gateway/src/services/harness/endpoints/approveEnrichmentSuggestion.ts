import { harnessClient } from '../client.js';
import { HARNESS_ENRICHMENT_TIMEOUT_MS } from '../../../constants/timeouts/HARNESS_ENRICHMENT_TIMEOUT_MS.js';

export function approveEnrichmentSuggestion(suggestionId: number, body: unknown): Promise<Response> {
  return harnessClient.post(`/enrichment/suggestions/${suggestionId}/approve`, body, HARNESS_ENRICHMENT_TIMEOUT_MS);
}
