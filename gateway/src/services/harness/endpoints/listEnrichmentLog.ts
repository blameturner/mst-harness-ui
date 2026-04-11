import { harnessClient } from '../client.js';
import { HARNESS_ENRICHMENT_TIMEOUT_MS } from '../../../constants/timeouts/HARNESS_ENRICHMENT_TIMEOUT_MS.js';

export function listEnrichmentLog(orgId: number, limit = 100): Promise<Response> {
  return harnessClient.get(`/enrichment/log?org_id=${orgId}&limit=${limit}`, HARNESS_ENRICHMENT_TIMEOUT_MS);
}
