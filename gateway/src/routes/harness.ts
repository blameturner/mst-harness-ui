import { Hono } from 'hono';
import { requireAuth } from '../middleware/requireAuth.js';
import { getAuthContext } from '../lib/auth-context.js';
import { FetchTimeoutError } from '../lib/FetchTimeoutError.js';
import { forwardResponse } from '../lib/forwardResponse.js';
import { getUsageStats } from '../services/harness/index.js';
import { harnessClient } from '../services/harness/client.js';
import type { AuthVariables } from '../types/AuthVariables.js';

const TIMEOUT = 15_000;

export const harnessRoute = new Hono<{ Variables: AuthVariables }>();

harnessRoute.use('*', requireAuth);

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

harnessRoute.get('/graph/snapshot', async (c) => {
  const { orgId } = getAuthContext(c);
  const url = new URL(c.req.url);
  const limit = url.searchParams.get('limit');
  const qs = `?org_id=${Number(orgId)}${limit ? `&limit=${encodeURIComponent(limit)}` : ''}`;
  try {
    const res = await harnessClient.get(`/graph/snapshot${qs}`, TIMEOUT);
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err);
  }
});

harnessRoute.get('/chroma/snapshot', async (c) => {
  const { orgId } = getAuthContext(c);
  try {
    const res = await harnessClient.get(`/chroma/snapshot?org_id=${Number(orgId)}`, TIMEOUT);
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err);
  }
});
