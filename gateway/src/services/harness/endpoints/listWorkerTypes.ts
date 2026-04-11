import { harnessClient } from '../client.js';
import { HARNESS_ENRICHMENT_TIMEOUT_MS } from '../../../constants/timeouts/HARNESS_ENRICHMENT_TIMEOUT_MS.js';

export function listWorkerTypes(): Promise<Response> {
  return harnessClient.get('/workers/types', HARNESS_ENRICHMENT_TIMEOUT_MS);
}
