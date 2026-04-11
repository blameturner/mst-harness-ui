import type { Context } from 'hono';
import { flushEnrichmentSource as harnessFlushEnrichmentSource } from '../../../services/harness/index.js';
import { forwardResponse } from '../../../lib/forwardResponse.js';
import { mapHarnessError } from '../../../lib/mapHarnessError.js';
import { parseIdParam } from '../../../lib/parseIdParam.js';

export async function flushSource(c: Context) {
  const id = parseIdParam(c.req.param('id'));
  if (id == null) return c.json({ error: 'invalid_id' }, 400);
  try {
    const res = await harnessFlushEnrichmentSource(id);
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'enrichment');
  }
}
