import { harnessClient } from '../client.js';
import { HARNESS_CONVERSATIONS_TIMEOUT_MS } from '../../../constants/timeouts/HARNESS_CONVERSATIONS_TIMEOUT_MS.js';

export function getConversationMessages(conversationId: number): Promise<Response> {
  return harnessClient.get(
    `/conversations/${conversationId}/messages`,
    HARNESS_CONVERSATIONS_TIMEOUT_MS,
  );
}
