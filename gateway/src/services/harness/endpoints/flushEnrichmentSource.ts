import { harnessClient } from '../client.js';
import { HARNESS_ENRICHMENT_TIMEOUT_MS } from '../../../constants/timeouts/HARNESS_ENRICHMENT_TIMEOUT_MS.js';

export function flushEnrichmentSource(sourceId: number): Promise<Response> {
  return harnessClient.post(`/enrichment/sources/${sourceId}/flush`, {}, HARNESS_ENRICHMENT_TIMEOUT_MS);
}
