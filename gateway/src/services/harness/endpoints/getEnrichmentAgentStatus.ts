import { harnessClient } from '../client.js';
import { HARNESS_SCHEDULER_TIMEOUT_MS } from '../../../constants/timeouts/HARNESS_SCHEDULER_TIMEOUT_MS.js';

export function getEnrichmentAgentStatus(id: number): Promise<Response> {
  return harnessClient.get(`/enrichment/agents/${id}/status`, HARNESS_SCHEDULER_TIMEOUT_MS);
}
