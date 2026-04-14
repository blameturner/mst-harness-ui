import { harnessClient } from '../client.js';
import { HARNESS_DEFAULT_TIMEOUT_MS } from '../../../constants/timeouts/HARNESS_DEFAULT_TIMEOUT_MS.js';

export function createCodebase(body: unknown): Promise<Response> {
  return harnessClient.post('/codebases', body, HARNESS_DEFAULT_TIMEOUT_MS);
}
