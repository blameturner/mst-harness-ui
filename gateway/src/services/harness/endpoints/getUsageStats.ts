import { harnessClient } from '../client.js';
import { HARNESS_ENRICHMENT_TIMEOUT_MS } from '../../../constants/timeouts/HARNESS_ENRICHMENT_TIMEOUT_MS.js';

export function getUsageStats(orgId: number, period: string): Promise<Response> {
  return harnessClient.get(`/stats/usage?org_id=${orgId}&period=${period}`, HARNESS_ENRICHMENT_TIMEOUT_MS);
}
