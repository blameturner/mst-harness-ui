import { harnessClient } from '../client.js';
import { HARNESS_ENRICHMENT_TIMEOUT_MS } from '../../../constants/timeouts/HARNESS_ENRICHMENT_TIMEOUT_MS.js';

export function patchEnrichmentSource(sourceId: number, body: unknown): Promise<Response> {
  return harnessClient.patch(`/enrichment/sources/${sourceId}`, body, HARNESS_ENRICHMENT_TIMEOUT_MS);
}
