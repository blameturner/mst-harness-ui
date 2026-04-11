import type { Context } from 'hono';
import { getAuthContext } from '../../../lib/auth-context.js';
import { createEnrichmentAgent } from '../../../services/harness/index.js';
import { forwardResponse } from '../../../lib/forwardResponse.js';
import { mapHarnessError } from '../../../lib/mapHarnessError.js';
import { createAgentSchema } from '../schemas/createAgentSchema.js';

export async function createAgent(c: Context) {
  const body = await c.req.json().catch(() => null);
  const parsed = createAgentSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'invalid_body', issues: parsed.error.issues }, 400);
  const { orgId } = getAuthContext(c);
  try {
    const res = await createEnrichmentAgent({ ...parsed.data, org_id: Number(orgId) });
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'enrichment');
  }
}
