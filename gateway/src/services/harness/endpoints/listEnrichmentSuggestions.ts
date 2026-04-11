import { harnessClient } from '../client.js';
import { HARNESS_ENRICHMENT_TIMEOUT_MS } from '../../../constants/timeouts/HARNESS_ENRICHMENT_TIMEOUT_MS.js';

export function listEnrichmentSuggestions(orgId: number, status?: string): Promise<Response> {
  const params = new URLSearchParams({ org_id: String(orgId) });
  if (status) params.set('status', status);
  return harnessClient.get(`/enrichment/suggestions?${params}`, HARNESS_ENRICHMENT_TIMEOUT_MS);
}
