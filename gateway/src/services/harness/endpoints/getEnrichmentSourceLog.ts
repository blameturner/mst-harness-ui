import { harnessClient } from '../client.js';
import { HARNESS_ENRICHMENT_TIMEOUT_MS } from '../../../constants/timeouts/HARNESS_ENRICHMENT_TIMEOUT_MS.js';

export function getEnrichmentSourceLog(sourceId: number, limit = 50): Promise<Response> {
  return harnessClient.get(`/enrichment/sources/${sourceId}/log?limit=${limit}`, HARNESS_ENRICHMENT_TIMEOUT_MS);
}
