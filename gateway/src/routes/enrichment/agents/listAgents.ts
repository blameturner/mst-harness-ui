import type { Context } from 'hono';
import { getAuthContext } from '../../../lib/auth-context.js';
import { listEnrichmentAgents } from '../../../services/harness/index.js';
import { forwardResponse } from '../../../lib/forwardResponse.js';
import { mapHarnessError } from '../../../lib/mapHarnessError.js';

export async function listAgents(c: Context) {
  const { orgId } = getAuthContext(c);
  try {
    const res = await listEnrichmentAgents(Number(orgId));
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'enrichment');
  }
}
