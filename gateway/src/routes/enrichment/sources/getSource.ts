import type { Context } from 'hono';
import { getEnrichmentSource as harnessGetEnrichmentSource } from '../../../services/harness/index.js';
import { forwardNormalised } from '../../../lib/forwardNormalised.js';
import { mapHarnessError } from '../../../lib/mapHarnessError.js';
import { parseIdParam } from '../../../lib/parseIdParam.js';
import { normaliseSource } from '../normalise/normaliseSource.js';

export async function getSource(c: Context) {
  const id = parseIdParam(c.req.param('id'));
  if (id == null) return c.json({ error: 'invalid_id' }, 400);
  try {
    const res = await harnessGetEnrichmentSource(id);
    return forwardNormalised(res, (body) => normaliseSource(body));
  } catch (err) {
    return mapHarnessError(err, 'enrichment');
  }
}
