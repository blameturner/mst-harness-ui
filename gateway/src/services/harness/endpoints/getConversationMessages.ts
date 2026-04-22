import { harnessClient } from '../client.js';
import { HARNESS_CONVERSATIONS_TIMEOUT_MS } from '../../../constants/timeouts/HARNESS_CONVERSATIONS_TIMEOUT_MS.js';

export function getConversationMessages(conversationId: number, orgId: number): Promise<Response> {
  return harnessClient.get(
    `/conversations/${conversationId}/messages?org_id=${orgId}`,
    HARNESS_CONVERSATIONS_TIMEOUT_MS,
  );
}
