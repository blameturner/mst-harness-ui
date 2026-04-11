import type { Context } from 'hono';
import { getAuthContext } from '../../../lib/auth-context.js';
import { listEnrichmentLog as harnessListEnrichmentLog } from '../../../services/harness/index.js';
import { forwardNormalised } from '../../../lib/forwardNormalised.js';
import { mapHarnessError } from '../../../lib/mapHarnessError.js';
import { normaliseLogEntry } from '../normalise/normaliseLogEntry.js';

export async function listLog(c: Context) {
  const { orgId } = getAuthContext(c);
  const url = new URL(c.req.url);
  const limit = Number(url.searchParams.get('limit')) || 100;
  try {
    const res = await harnessListEnrichmentLog(Number(orgId), limit);
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
