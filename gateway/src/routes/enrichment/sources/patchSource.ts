import type { Context } from 'hono';
import { patchEnrichmentSource as harnessPatchEnrichmentSource } from '../../../services/harness/index.js';
import { forwardNormalised } from '../../../lib/forwardNormalised.js';
import { mapHarnessError } from '../../../lib/mapHarnessError.js';
import { parseIdParam } from '../../../lib/parseIdParam.js';
import { normaliseSource } from '../normalise/normaliseSource.js';
import { updateSourceSchema } from '../schemas/updateSourceSchema.js';

export async function patchSource(c: Context) {
  const body = await c.req.json().catch(() => null);
  const parsed = updateSourceSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid_body', issues: parsed.error.issues }, 400);
  }
  const id = parseIdParam(c.req.param('id'));
  if (id == null) return c.json({ error: 'invalid_id' }, 400);
  try {
    const res = await harnessPatchEnrichmentSource(id, parsed.data);
    return forwardNormalised(res, (body) => normaliseSource(body));
  } catch (err) {
    return mapHarnessError(err, 'enrichment');
  }
}
