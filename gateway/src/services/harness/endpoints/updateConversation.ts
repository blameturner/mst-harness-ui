import { harnessClient } from '../client.js';
import { HARNESS_CONVERSATIONS_TIMEOUT_MS } from '../../../constants/timeouts/HARNESS_CONVERSATIONS_TIMEOUT_MS.js';

export function updateConversation(
  conversationId: number,
  orgId: number,
  body: { title?: string; contextual_grounding_enabled?: boolean; deleted_at?: string },
): Promise<Response> {
  return harnessClient.patch(
    `/conversations/${conversationId}?org_id=${orgId}`,
    body,
    HARNESS_CONVERSATIONS_TIMEOUT_MS,
  );
}
