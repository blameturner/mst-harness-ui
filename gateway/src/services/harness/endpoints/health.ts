import { harnessClient } from '../client.js';
import { HARNESS_HEALTH_TIMEOUT_MS } from '../../../constants/timeouts/HARNESS_HEALTH_TIMEOUT_MS.js';

export function health(): Promise<Response> {
  return harnessClient.get('/health', HARNESS_HEALTH_TIMEOUT_MS);
}
