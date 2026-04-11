import type { Context } from 'hono';
import { assertInteger } from '../../../lib/assertInteger.js';
import { patchEnrichmentAgent } from '../../../services/harness/index.js';
import { forwardResponse } from '../../../lib/forwardResponse.js';
import { mapHarnessError } from '../../../lib/mapHarnessError.js';

export async function patchAgent(c: Context) {
  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: 'invalid_body' }, 400);
  let id: number;
  try { id = assertInteger(c.req.param('id'), 'agent_id'); } catch { return c.json({ error: 'invalid_id' }, 400); }
  try {
    const res = await patchEnrichmentAgent(id, body);
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'enrichment');
  }
}
