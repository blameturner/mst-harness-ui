import { harnessClient } from '../client.js';
import { HARNESS_ENRICHMENT_TIMEOUT_MS } from '../../../constants/timeouts/HARNESS_ENRICHMENT_TIMEOUT_MS.js';

export function createEnrichmentSource(body: unknown): Promise<Response> {
  return harnessClient.post('/enrichment/sources', body, HARNESS_ENRICHMENT_TIMEOUT_MS);
}
