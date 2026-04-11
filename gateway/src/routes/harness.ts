import { Hono } from 'hono';
import { requireAuth } from '../middleware/requireAuth.js';
import { getAuthContext } from '../lib/auth-context.js';
import { FetchTimeoutError } from '../lib/fetch-with-timeout.js';
import { forwardResponse } from '../lib/forwardResponse.js';
import { getUsageStats } from '../services/harness/index.js';
import type { AuthVariables } from '../types/auth.js';

export const harnessRoute = new Hono<{ Variables: AuthVariables }>();

harnessRoute.use('*', requireAuth);

// TODO: dedupe after reconciling log message format
function mapHarnessError(err: unknown) {
  if (err instanceof FetchTimeoutError) {
    return new Response(JSON.stringify({ error: 'harness_timeout' }), {
      status: 504,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  console.error('[harness] unreachable', err);
  return new Response(JSON.stringify({ error: 'harness_unreachable' }), {
    status: 502,
    headers: { 'Content-Type': 'application/json' },
  });
}

harnessRoute.get('/stats/usage', async (c) => {
  const { orgId } = getAuthContext(c);
  const url = new URL(c.req.url);
  const period = url.searchParams.get('period') ?? '7d';
  try {
    const res = await getUsageStats(Number(orgId), period);
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err);
  }
});
