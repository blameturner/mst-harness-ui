import { harnessClient } from '../client.js';
import { HARNESS_ENRICHMENT_TIMEOUT_MS } from '../../../constants/timeouts/HARNESS_ENRICHMENT_TIMEOUT_MS.js';

export function listEnrichmentSources(
  orgId: number,
  opts?: { agent_id?: number; active_only?: boolean },
): Promise<Response> {
  const params = new URLSearchParams({ org_id: String(orgId) });
  if (opts?.agent_id != null) params.set('agent_id', String(opts.agent_id));
  if (opts?.active_only != null) params.set('active_only', String(opts.active_only));
  return harnessClient.get(`/enrichment/sources?${params}`, HARNESS_ENRICHMENT_TIMEOUT_MS);
}
