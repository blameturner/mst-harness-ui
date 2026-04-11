import type { Context } from 'hono';
import { getAuthContext } from '../../../lib/auth-context.js';
import { listEnrichmentSources as harnessListEnrichmentSources } from '../../../services/harness/index.js';
import { forwardNormalised } from '../../../lib/forwardNormalised.js';
import { mapHarnessError } from '../../../lib/mapHarnessError.js';
import { normaliseSource } from '../normalise/normaliseSource.js';

export async function listSources(c: Context) {
  const { orgId } = getAuthContext(c);
  const url = new URL(c.req.url);
  const agentId = url.searchParams.get('agent_id');
  const activeOnly = url.searchParams.get('active_only');
  try {
    const res = await harnessListEnrichmentSources(Number(orgId), {
      agent_id: agentId ? Number(agentId) : undefined,
      active_only: activeOnly ? activeOnly === 'true' : undefined,
    });
    return forwardNormalised(res, (body) => {
      const sources = Array.isArray(body.sources) ? body.sources : Array.isArray(body) ? body : [];
      return { sources: sources.map((s: Record<string, unknown>) => normaliseSource(s)) };
    });
  } catch (err) {
    return mapHarnessError(err, 'enrichment');
  }
}
