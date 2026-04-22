import { harnessClient } from '../client.js';
import { HARNESS_CONVERSATIONS_TIMEOUT_MS } from '../../../constants/timeouts/HARNESS_CONVERSATIONS_TIMEOUT_MS.js';

export function getCodeConversationMessages(conversationId: number, orgId: number): Promise<Response> {
  return harnessClient.get(
    `/code/conversations/${conversationId}/messages?org_id=${orgId}`,
    HARNESS_CONVERSATIONS_TIMEOUT_MS,
  );
}
