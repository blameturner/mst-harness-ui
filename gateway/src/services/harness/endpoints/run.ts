import { harnessClient } from '../client.js';
import { HARNESS_RUN_TIMEOUT_MS } from '../../../constants/timeouts/HARNESS_RUN_TIMEOUT_MS.js';
import type { HarnessRunRequest } from '../../../types/HarnessRunRequest.js';

export function run(payload: HarnessRunRequest): Promise<Response> {
  return harnessClient.post('/run', payload, HARNESS_RUN_TIMEOUT_MS);
}
