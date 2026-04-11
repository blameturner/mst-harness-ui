import { harnessClient } from '../client.js';
import { HARNESS_CONVERSATIONS_TIMEOUT_MS } from '../../../constants/timeouts/HARNESS_CONVERSATIONS_TIMEOUT_MS.js';

export function listAgents(orgId: number): Promise<Response> {
  return harnessClient.get(
    `/agents?org_id=${orgId}`,
    HARNESS_CONVERSATIONS_TIMEOUT_MS,
  );
}
