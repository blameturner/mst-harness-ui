import { harnessClient } from '../client.js';
import { HARNESS_MODELS_TIMEOUT_MS } from '../../../constants/timeouts/HARNESS_MODELS_TIMEOUT_MS.js';

export function listModels(): Promise<Response> {
  return harnessClient.get('/models', HARNESS_MODELS_TIMEOUT_MS);
}
