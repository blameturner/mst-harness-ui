import type { Context } from 'hono';
import { getAuthContext } from '../../../lib/auth-context.js';
import { createEnrichmentSource as harnessCreateEnrichmentSource } from '../../../services/harness/index.js';
import { forwardNormalised } from '../../../lib/forwardNormalised.js';
import { mapHarnessError } from '../../../lib/mapHarnessError.js';
import { normaliseSource } from '../normalise/normaliseSource.js';
import { createSourceSchema } from '../schemas/createSourceSchema.js';

export async function createSource(c: Context) {
  const body = await c.req.json().catch(() => null);
  const parsed = createSourceSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid_body', issues: parsed.error.issues }, 400);
  }
  const { orgId } = getAuthContext(c);
  try {
    const res = await harnessCreateEnrichmentSource({ ...parsed.data, org_id: Number(orgId) });
    return forwardNormalised(res, (body) => normaliseSource(body));
  } catch (err) {
    return mapHarnessError(err, 'enrichment');
  }
}
