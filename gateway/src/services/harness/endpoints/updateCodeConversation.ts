import { harnessClient } from '../client.js';
import { HARNESS_CONVERSATIONS_TIMEOUT_MS } from '../../../constants/timeouts/HARNESS_CONVERSATIONS_TIMEOUT_MS.js';

export function updateCodeConversation(
  conversationId: number,
  body: { title?: string },
): Promise<Response> {
  return harnessClient.patch(
    `/code/conversations/${conversationId}`,
    body,
    HARNESS_CONVERSATIONS_TIMEOUT_MS,
  );
}
