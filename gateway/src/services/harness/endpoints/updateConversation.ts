import { harnessClient } from '../client.js';
import { HARNESS_CONVERSATIONS_TIMEOUT_MS } from '../../../constants/timeouts/HARNESS_CONVERSATIONS_TIMEOUT_MS.js';

export function updateConversation(
  conversationId: number,
  body: { title?: string; contextual_grounding_enabled?: boolean },
): Promise<Response> {
  return harnessClient.patch(
    `/conversations/${conversationId}`,
    body,
    HARNESS_CONVERSATIONS_TIMEOUT_MS,
  );
}
