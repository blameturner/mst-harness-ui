import { harnessClient } from '../client.js';
import { HARNESS_RUN_TIMEOUT_MS } from '../../../constants/timeouts/HARNESS_RUN_TIMEOUT_MS.js';

export function indexCodebase(id: number, body: unknown): Promise<Response> {
  return harnessClient.post(`/codebases/${id}/index`, body, HARNESS_RUN_TIMEOUT_MS);
}
