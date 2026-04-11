import { harnessClient } from '../client.js';
import { HARNESS_CONVERSATIONS_TIMEOUT_MS } from '../../../constants/timeouts/HARNESS_CONVERSATIONS_TIMEOUT_MS.js';

export function getConversationSummary(conversationId: number): Promise<Response> {
  return harnessClient.get(
    `/conversations/${conversationId}/summary`,
    HARNESS_CONVERSATIONS_TIMEOUT_MS,
  );
}
