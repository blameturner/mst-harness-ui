import { Hono } from 'hono';
import type { Context } from 'hono';
import { requireAuth } from '../middleware/requireAuth.js';
import { getAuthContext } from '../lib/auth-context.js';
import { mapHarnessError } from '../lib/mapHarnessError.js';
import { forwardResponse } from '../lib/forwardResponse.js';
import type { AuthVariables } from '../types/AuthVariables.js';
import { harnessClient } from '../services/harness/client.js';

const TIMEOUT = 30_000;
const TAG = 'simulations';

function withOrg(c: Context, path: string): string {
  const { orgId } = getAuthContext(c);
  const url = new URL(c.req.url);
  url.searchParams.set('org_id', String(Number(orgId)));
  const qs = url.searchParams.toString();
  return `${path}${qs ? `?${qs}` : ''}`;
}

async function readBody(c: Context): Promise<Record<string, unknown>> {
  const raw = await c.req.json().catch(() => null);
  return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
}

export const simulationsRoute = new Hono<{ Variables: AuthVariables }>();

simulationsRoute.use('*', requireAuth);

simulationsRoute.get('/', async (c) => {
  try {
    const res = await harnessClient.get(withOrg(c, '/simulations'), TIMEOUT);
    return forwardResponse(res, TAG);
  } catch (err) {
    return mapHarnessError(err, TAG);
  }
});

simulationsRoute.post('/', async (c) => {
  const { orgId } = getAuthContext(c);
  const body = await readBody(c);
  try {
    const res = await harnessClient.post(
      '/simulations',
      { ...body, org_id: Number(orgId) },
      TIMEOUT,
    );
    return forwardResponse(res, TAG);
  } catch (err) {
    return mapHarnessError(err, TAG);
  }
});

simulationsRoute.get('/:id', async (c) => {
  const id = c.req.param('id');
  try {
    const res = await harnessClient.get(
      withOrg(c, `/simulations/${encodeURIComponent(id)}`),
      TIMEOUT,
    );
    return forwardResponse(res, TAG);
  } catch (err) {
    return mapHarnessError(err, TAG);
  }
});

simulationsRoute.post('/:id/cancel', async (c) => {
  const id = c.req.param('id');
  try {
    const res = await harnessClient.post(
      `/simulations/${encodeURIComponent(id)}/cancel`,
      {},
      TIMEOUT,
    );
    return forwardResponse(res, TAG);
  } catch (err) {
    return mapHarnessError(err, TAG);
  }
});
