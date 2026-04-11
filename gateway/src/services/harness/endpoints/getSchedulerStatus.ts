import { harnessClient } from '../client.js';
import { HARNESS_SCHEDULER_TIMEOUT_MS } from '../../../constants/timeouts/HARNESS_SCHEDULER_TIMEOUT_MS.js';

export function getSchedulerStatus(): Promise<Response> {
  return harnessClient.get('/scheduler/status', HARNESS_SCHEDULER_TIMEOUT_MS);
}
