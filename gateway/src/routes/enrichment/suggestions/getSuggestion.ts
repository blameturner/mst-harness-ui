import type { Context } from 'hono';
import { getEnrichmentSuggestion as harnessGetEnrichmentSuggestion } from '../../../services/harness/index.js';
import { forwardNormalised } from '../../../lib/forwardNormalised.js';
import { mapHarnessError } from '../../../lib/mapHarnessError.js';
import { parseIdParam } from '../../../lib/parseIdParam.js';
import { normaliseSuggestion } from '../normalise/normaliseSuggestion.js';

export async function getSuggestion(c: Context) {
  const id = parseIdParam(c.req.param('id'));
  if (id == null) return c.json({ error: 'invalid_id' }, 400);
  try {
    const res = await harnessGetEnrichmentSuggestion(id);
    return forwardNormalised(res, (body) => normaliseSuggestion(body));
  } catch (err) {
    return mapHarnessError(err, 'enrichment');
  }
}
