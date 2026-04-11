import type { Context } from 'hono';
import { assertInteger } from '../../../lib/assertInteger.js';
import { triggerEnrichmentAgent } from '../../../services/harness/index.js';
import { forwardResponse } from '../../../lib/forwardResponse.js';
import { mapHarnessError } from '../../../lib/mapHarnessError.js';

export async function triggerAgent(c: Context) {
  let id: number;
  try { id = assertInteger(c.req.param('id'), 'agent_id'); } catch { return c.json({ error: 'invalid_id' }, 400); }
  try {
    const res = await triggerEnrichmentAgent(id);
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'enrichment');
  }
}
