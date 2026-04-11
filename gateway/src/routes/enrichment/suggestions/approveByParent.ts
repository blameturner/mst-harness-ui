import type { Context } from 'hono';
import { approveEnrichmentSuggestionsByParent } from '../../../services/harness/index.js';
import { forwardResponse } from '../../../lib/forwardResponse.js';
import { mapHarnessError } from '../../../lib/mapHarnessError.js';

export async function approveByParent(c: Context) {
  const body = await c.req.json().catch(() => null);
  if (!body || body.parent_target == null) return c.json({ error: 'invalid_body' }, 400);
  try {
    const res = await approveEnrichmentSuggestionsByParent(body);
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'enrichment');
  }
}
