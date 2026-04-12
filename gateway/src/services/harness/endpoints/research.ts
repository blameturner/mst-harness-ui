import { harnessClient } from '../client.js';
import { HARNESS_CHAT_TIMEOUT_MS } from '../../../constants/timeouts/HARNESS_CHAT_TIMEOUT_MS.js';

export function research(payload: {
  org_id: number;
  model: string;
  question: string;
  conversation_id?: number;
}): Promise<Response> {
  return harnessClient.post('/research', payload, HARNESS_CHAT_TIMEOUT_MS);
}
