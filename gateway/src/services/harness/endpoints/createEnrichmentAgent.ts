import { harnessClient } from '../client.js';
import { HARNESS_ENRICHMENT_TIMEOUT_MS } from '../../../constants/timeouts/HARNESS_ENRICHMENT_TIMEOUT_MS.js';

export function createEnrichmentAgent(body: unknown): Promise<Response> {
  return harnessClient.post('/enrichment/agents', body, HARNESS_ENRICHMENT_TIMEOUT_MS);
}
