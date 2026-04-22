import { harnessClient } from '../client.js';
import { HARNESS_CONVERSATIONS_TIMEOUT_MS } from '../../../constants/timeouts/HARNESS_CONVERSATIONS_TIMEOUT_MS.js';

export function updateCodeConversation(
  conversationId: number,
  orgId: number,
  body: { title?: string },
): Promise<Response> {
  return harnessClient.patch(
    `/code/conversations/${conversationId}?org_id=${orgId}`,
    body,
    HARNESS_CONVERSATIONS_TIMEOUT_MS,
  );
}
