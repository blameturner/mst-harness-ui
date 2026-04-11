import { harnessClient } from '../client.js';
import { HARNESS_CHAT_TIMEOUT_MS } from '../../../constants/timeouts/HARNESS_CHAT_TIMEOUT_MS.js';
import type { HarnessChatRequest } from '../../../types/HarnessChatRequest.js';

export function chat(payload: HarnessChatRequest): Promise<Response> {
  return harnessClient.post('/chat', payload, HARNESS_CHAT_TIMEOUT_MS);
}
