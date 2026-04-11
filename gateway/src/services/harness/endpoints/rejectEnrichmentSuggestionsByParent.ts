import { harnessClient } from '../client.js';
import { HARNESS_ENRICHMENT_TIMEOUT_MS } from '../../../constants/timeouts/HARNESS_ENRICHMENT_TIMEOUT_MS.js';

export function rejectEnrichmentSuggestionsByParent(body: unknown): Promise<Response> {
  return harnessClient.post('/enrichment/suggestions/reject-by-parent', body, HARNESS_ENRICHMENT_TIMEOUT_MS);
}
