import { harnessClient } from '../client.js';
import { HARNESS_MODELS_TIMEOUT_MS } from '../../../constants/timeouts/HARNESS_MODELS_TIMEOUT_MS.js';

export function listStyles(surface?: 'chat' | 'code'): Promise<Response> {
  const q = surface ? `?surface=${surface}` : '';
  return harnessClient.get(`/styles${q}`, HARNESS_MODELS_TIMEOUT_MS);
}
