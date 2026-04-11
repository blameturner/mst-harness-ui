import { harnessClient } from '../client.js';
import { HARNESS_SCHEDULER_TIMEOUT_MS } from '../../../constants/timeouts/HARNESS_SCHEDULER_TIMEOUT_MS.js';

export function triggerEnrichmentAgent(id: number): Promise<Response> {
  return harnessClient.post(`/enrichment/agents/${id}/trigger`, {}, HARNESS_SCHEDULER_TIMEOUT_MS);
}
