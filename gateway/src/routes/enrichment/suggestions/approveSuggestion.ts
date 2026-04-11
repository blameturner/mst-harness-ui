import type { Context } from 'hono';
import { approveEnrichmentSuggestion as harnessApproveEnrichmentSuggestion } from '../../../services/harness/index.js';
import { forwardResponse } from '../../../lib/forwardResponse.js';
import { mapHarnessError } from '../../../lib/mapHarnessError.js';
import { parseIdParam } from '../../../lib/parseIdParam.js';

export async function approveSuggestion(c: Context) {
  const body = await c.req.json().catch(() => ({}));
  const id = parseIdParam(c.req.param('id'));
  if (id == null) return c.json({ error: 'invalid_id' }, 400);
  try {
    const res = await harnessApproveEnrichmentSuggestion(id, body);
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'enrichment');
  }
}
