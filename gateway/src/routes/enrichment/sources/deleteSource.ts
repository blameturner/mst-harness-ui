import type { Context } from 'hono';
import { deleteEnrichmentSource as harnessDeleteEnrichmentSource } from '../../../services/harness/index.js';
import { forwardResponse } from '../../../lib/forwardResponse.js';
import { mapHarnessError } from '../../../lib/mapHarnessError.js';
import { parseIdParam } from '../../../lib/parseIdParam.js';

export async function deleteSource(c: Context) {
  const id = parseIdParam(c.req.param('id'));
  if (id == null) return c.json({ error: 'invalid_id' }, 400);
  try {
    const res = await harnessDeleteEnrichmentSource(id);
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'enrichment');
  }
}
