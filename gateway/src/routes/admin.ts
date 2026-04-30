import { Hono } from 'hono';
import type { Context } from 'hono';
import { requireAuth } from '../middleware/requireAuth.js';
import { getAuthContext } from '../lib/auth-context.js';
import { mapHarnessError } from '../lib/mapHarnessError.js';
import { forwardResponse } from '../lib/forwardResponse.js';
import type { AuthVariables } from '../types/AuthVariables.js';
import { harnessClient } from '../services/harness/client.js';

const TIMEOUT = 30_000;
const TAG = 'admin';

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

export const adminRoute = new Hono<{ Variables: AuthVariables }>();

adminRoute.use('*', requireAuth);

adminRoute.get('/runtime', async (c) => {
  try {
    const res = await harnessClient.get(withOrg(c, '/admin/runtime'), TIMEOUT);
    return forwardResponse(res, TAG);
  } catch (err) {
    return mapHarnessError(err, TAG);
  }
});

adminRoute.get('/subsystems', async (c) => {
  try {
    const res = await harnessClient.get(withOrg(c, '/admin/subsystems'), TIMEOUT);
    return forwardResponse(res, TAG);
  } catch (err) {
    return mapHarnessError(err, TAG);
  }
});

adminRoute.post('/subsystems/:id/enable', async (c) => {
  const id = c.req.param('id');
  const body = await readBody(c);
  try {
    const res = await harnessClient.post(
      `/admin/subsystems/${encodeURIComponent(id)}/enable`,
      body,
      TIMEOUT,
    );
    return forwardResponse(res, TAG);
  } catch (err) {
    return mapHarnessError(err, TAG);
  }
});

adminRoute.post('/subsystems/:id/disable', async (c) => {
  const id = c.req.param('id');
  const body = await readBody(c);
  try {
    const res = await harnessClient.post(
      `/admin/subsystems/${encodeURIComponent(id)}/disable`,
      body,
      TIMEOUT,
    );
    return forwardResponse(res, TAG);
  } catch (err) {
    return mapHarnessError(err, TAG);
  }
});

adminRoute.get('/config', async (c) => {
  try {
    const res = await harnessClient.get('/admin/config', TIMEOUT);
    return forwardResponse(res, TAG);
  } catch (err) {
    return mapHarnessError(err, TAG);
  }
});

// Static /config-history before dynamic /config/:section
adminRoute.get('/config-history', async (c) => {
  try {
    const url = new URL(c.req.url);
    const qs = url.searchParams.toString();
    const res = await harnessClient.get(`/admin/config-history${qs ? `?${qs}` : ''}`, TIMEOUT);
    return forwardResponse(res, TAG);
  } catch (err) {
    return mapHarnessError(err, TAG);
  }
});

adminRoute.get('/config/:section/schema', async (c) => {
  const section = c.req.param('section');
  try {
    const res = await harnessClient.get(
      `/admin/config/${encodeURIComponent(section)}/schema`,
      TIMEOUT,
    );
    return forwardResponse(res, TAG);
  } catch (err) {
    return mapHarnessError(err, TAG);
  }
});

adminRoute.get('/config/:section/history', async (c) => {
  const section = c.req.param('section');
  try {
    const url = new URL(c.req.url);
    const qs = url.searchParams.toString();
    const res = await harnessClient.get(
      `/admin/config/${encodeURIComponent(section)}/history${qs ? `?${qs}` : ''}`,
      TIMEOUT,
    );
    return forwardResponse(res, TAG);
  } catch (err) {
    return mapHarnessError(err, TAG);
  }
});

adminRoute.get('/config/:section', async (c) => {
  const section = c.req.param('section');
  try {
    const res = await harnessClient.get(
      `/admin/config/${encodeURIComponent(section)}`,
      TIMEOUT,
    );
    return forwardResponse(res, TAG);
  } catch (err) {
    return mapHarnessError(err, TAG);
  }
});

adminRoute.patch('/config/:section', async (c) => {
  const section = c.req.param('section');
  const body = await readBody(c);
  try {
    const res = await harnessClient.patch(
      `/admin/config/${encodeURIComponent(section)}`,
      body,
      TIMEOUT,
    );
    return forwardResponse(res, TAG);
  } catch (err) {
    return mapHarnessError(err, TAG);
  }
});

adminRoute.get('/trigger/:id/schema', async (c) => {
  const id = c.req.param('id');
  try {
    const res = await harnessClient.get(
      `/admin/trigger/${encodeURIComponent(id)}/schema`,
      TIMEOUT,
    );
    return forwardResponse(res, TAG);
  } catch (err) {
    return mapHarnessError(err, TAG);
  }
});

adminRoute.post('/trigger/:id', async (c) => {
  const id = c.req.param('id');
  const { orgId } = getAuthContext(c);
  const body = await readBody(c);
  try {
    const res = await harnessClient.post(
      `/admin/trigger/${encodeURIComponent(id)}`,
      { ...body, org_id: Number(orgId) },
      120_000,
    );
    return forwardResponse(res, TAG);
  } catch (err) {
    return mapHarnessError(err, TAG);
  }
});
