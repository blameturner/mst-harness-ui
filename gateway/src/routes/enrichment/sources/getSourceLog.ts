import type { Context } from 'hono';
import { getEnrichmentSourceLog as harnessGetEnrichmentSourceLog } from '../../../services/harness/index.js';
import { forwardNormalised } from '../../../lib/forwardNormalised.js';
import { mapHarnessError } from '../../../lib/mapHarnessError.js';
import { parseIdParam } from '../../../lib/parseIdParam.js';
import { normaliseLogEntry } from '../normalise/normaliseLogEntry.js';

export async function getSourceLog(c: Context) {
  const id = parseIdParam(c.req.param('id'));
  if (id == null) return c.json({ error: 'invalid_id' }, 400);
  const url = new URL(c.req.url);
  const limit = Number(url.searchParams.get('limit')) || 50;
  try {
    const res = await harnessGetEnrichmentSourceLog(id, limit);
    return forwardNormalised(res, (body) => {
      const entries = Array.isArray(body.entries) ? body.entries
        : Array.isArray(body.logs) ? body.logs
        : Array.isArray(body.log) ? body.log
        : Array.isArray(body) ? body : [];
      return { entries: entries.map((e: Record<string, unknown>) => normaliseLogEntry(e)) };
    });
  } catch (err) {
    return mapHarnessError(err, 'enrichment');
  }
}
