import { harnessClient } from '../client.js';
import { HARNESS_CONVERSATIONS_TIMEOUT_MS } from '../../../constants/timeouts/HARNESS_CONVERSATIONS_TIMEOUT_MS.js';

export function listCodeConversations(orgId: number, limit = 50): Promise<Response> {
  return harnessClient.get(
    `/code/conversations?org_id=${orgId}&limit=${limit}`,
    HARNESS_CONVERSATIONS_TIMEOUT_MS,
  );
}
