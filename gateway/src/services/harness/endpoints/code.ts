import { harnessClient } from '../client.js';
import { HARNESS_CHAT_TIMEOUT_MS } from '../../../constants/timeouts/HARNESS_CHAT_TIMEOUT_MS.js';
import type { HarnessCodeRequest } from '../../../types/HarnessCodeRequest.js';

export function code(payload: HarnessCodeRequest): Promise<Response> {
  return harnessClient.post('/code', payload, HARNESS_CHAT_TIMEOUT_MS);
}
