import { harnessClient } from '../client.js';
import { HARNESS_ENRICHMENT_TIMEOUT_MS } from '../../../constants/timeouts/HARNESS_ENRICHMENT_TIMEOUT_MS.js';

export function getEnrichmentSource(sourceId: number): Promise<Response> {
  return harnessClient.get(`/enrichment/sources/${sourceId}`, HARNESS_ENRICHMENT_TIMEOUT_MS);
}
