import { harnessClient } from '../client.js';
import { HARNESS_ENRICHMENT_TIMEOUT_MS } from '../../../constants/timeouts/HARNESS_ENRICHMENT_TIMEOUT_MS.js';

export function listCodebases(orgId: number): Promise<Response> {
  return harnessClient.get(`/codebases?org_id=${orgId}`, HARNESS_ENRICHMENT_TIMEOUT_MS);
}
