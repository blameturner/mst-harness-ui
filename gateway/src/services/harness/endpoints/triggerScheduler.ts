import { harnessClient } from '../client.js';
import { HARNESS_SCHEDULER_TIMEOUT_MS } from '../../../constants/timeouts/HARNESS_SCHEDULER_TIMEOUT_MS.js';

export function triggerScheduler(): Promise<Response> {
  return harnessClient.post('/scheduler/trigger', {}, HARNESS_SCHEDULER_TIMEOUT_MS);
}
