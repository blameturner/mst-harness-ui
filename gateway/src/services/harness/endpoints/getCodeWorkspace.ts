import { harnessClient } from '../client.js';
import { HARNESS_CONVERSATIONS_TIMEOUT_MS } from '../../../constants/timeouts/HARNESS_CONVERSATIONS_TIMEOUT_MS.js';

export function getCodeWorkspace(conversationId: number): Promise<Response> {
  return harnessClient.get(
    `/code/conversations/${conversationId}/workspace`,
    HARNESS_CONVERSATIONS_TIMEOUT_MS,
  );
}
