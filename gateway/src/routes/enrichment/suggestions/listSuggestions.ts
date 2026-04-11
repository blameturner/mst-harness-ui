import type { Context } from 'hono';
import { getAuthContext } from '../../../lib/auth-context.js';
import { listEnrichmentSuggestions as harnessListEnrichmentSuggestions } from '../../../services/harness/index.js';
import { forwardNormalised } from '../../../lib/forwardNormalised.js';
import { mapHarnessError } from '../../../lib/mapHarnessError.js';
import { normaliseSuggestion } from '../normalise/normaliseSuggestion.js';

export async function listSuggestions(c: Context) {
  const { orgId } = getAuthContext(c);
  const url = new URL(c.req.url);
  const status = url.searchParams.get('status') ?? undefined;
  try {
    const res = await harnessListEnrichmentSuggestions(Number(orgId), status);
    return forwardNormalised(res, (body) => {
      const suggestions = Array.isArray(body.suggestions) ? body.suggestions : Array.isArray(body) ? body : [];
      return { suggestions: suggestions.map((s: Record<string, unknown>) => normaliseSuggestion(s)) };
    });
  } catch (err) {
    return mapHarnessError(err, 'enrichment');
  }
}
