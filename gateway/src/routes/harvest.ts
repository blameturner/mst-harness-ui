import { Hono } from 'hono';
import type { Context } from 'hono';
import { requireAuth } from '../middleware/requireAuth.js';
import { getAuthContext } from '../lib/auth-context.js';
import { mapHarnessError } from '../lib/mapHarnessError.js';
import { forwardResponse } from '../lib/forwardResponse.js';
import type { AuthVariables } from '../types/AuthVariables.js';
import { harnessClient } from '../services/harness/client.js';

const TIMEOUT = 30_000;
const TAG = 'harvest';

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

export const harvestRoute = new Hono<{ Variables: AuthVariables }>();

harvestRoute.use('*', requireAuth);

// ── catalog ─────────────────────────────────────────────────────────────

harvestRoute.get('/policies', async (c) => {
  try {
    const res = await harnessClient.get(withOrg(c, '/harvest/policies'), TIMEOUT);
    return forwardResponse(res, TAG);
  } catch (err) {
    return mapHarnessError(err, TAG);
  }
});

// ── trigger ─────────────────────────────────────────────────────────────

harvestRoute.post('/scrape-now', async (c) => {
  const body = await readBody(c);
  const { orgId } = getAuthContext(c);
  try {
    const res = await harnessClient.post(
      '/harvest/scrape-now',
      { ...body, org_id: Number(orgId) },
      TIMEOUT,
    );
    return forwardResponse(res, TAG);
  } catch (err) {
    return mapHarnessError(err, TAG);
  }
});

harvestRoute.post('/bulk-upload', async (c) => {
  const body = await readBody(c);
  const { orgId } = getAuthContext(c);
  try {
    const res = await harnessClient.post(
      '/harvest/bulk-upload',
      { ...body, org_id: Number(orgId) },
      TIMEOUT,
    );
    return forwardResponse(res, TAG);
  } catch (err) {
    return mapHarnessError(err, TAG);
  }
});

harvestRoute.post('/run/:policy', async (c) => {
  const policy = c.req.param('policy');
  const body = await readBody(c);
  const { orgId } = getAuthContext(c);
  try {
    const res = await harnessClient.post(
      `/harvest/run/${encodeURIComponent(policy)}`,
      { ...body, org_id: Number(orgId) },
      TIMEOUT,
    );
    return forwardResponse(res, TAG);
  } catch (err) {
    return mapHarnessError(err, TAG);
  }
});

// ── live polling ────────────────────────────────────────────────────────

harvestRoute.get('/active', async (c) => {
  try {
    const res = await harnessClient.get(withOrg(c, '/harvest/active'), TIMEOUT);
    return forwardResponse(res, TAG);
  } catch (err) {
    return mapHarnessError(err, TAG);
  }
});

// ── runs (static before dynamic) ────────────────────────────────────────

harvestRoute.get('/runs', async (c) => {
  try {
    const res = await harnessClient.get(withOrg(c, '/harvest/runs'), TIMEOUT);
    return forwardResponse(res, TAG);
  } catch (err) {
    return mapHarnessError(err, TAG);
  }
});

harvestRoute.get('/runs/:runId', async (c) => {
  const runId = c.req.param('runId');
  try {
    const res = await harnessClient.get(
      withOrg(c, `/harvest/runs/${encodeURIComponent(runId)}`),
      TIMEOUT,
    );
    return forwardResponse(res, TAG);
  } catch (err) {
    return mapHarnessError(err, TAG);
  }
});

harvestRoute.get('/runs/:runId/log', async (c) => {
  const runId = c.req.param('runId');
  try {
    const res = await harnessClient.get(
      withOrg(c, `/harvest/runs/${encodeURIComponent(runId)}/log`),
      TIMEOUT,
    );
    return forwardResponse(res, TAG);
  } catch (err) {
    return mapHarnessError(err, TAG);
  }
});

harvestRoute.get('/runs/:runId/artifacts', async (c) => {
  const runId = c.req.param('runId');
  try {
    const res = await harnessClient.get(
      withOrg(c, `/harvest/runs/${encodeURIComponent(runId)}/artifacts`),
      TIMEOUT,
    );
    return forwardResponse(res, TAG);
  } catch (err) {
    return mapHarnessError(err, TAG);
  }
});

harvestRoute.post('/runs/:runId/cancel', async (c) => {
  const runId = c.req.param('runId');
  try {
    const res = await harnessClient.post(
      `/harvest/runs/${encodeURIComponent(runId)}/cancel`,
      {},
      TIMEOUT,
    );
    return forwardResponse(res, TAG);
  } catch (err) {
    return mapHarnessError(err, TAG);
  }
});

harvestRoute.post('/runs/:runId/retry', async (c) => {
  const runId = c.req.param('runId');
  try {
    const res = await harnessClient.post(
      `/harvest/runs/${encodeURIComponent(runId)}/retry`,
      {},
      TIMEOUT,
    );
    return forwardResponse(res, TAG);
  } catch (err) {
    return mapHarnessError(err, TAG);
  }
});

// ── per-host config (static /reload before dynamic /:host) ──────────────

harvestRoute.get('/hosts', async (c) => {
  try {
    const res = await harnessClient.get('/harvest/hosts', TIMEOUT);
    return forwardResponse(res, TAG);
  } catch (err) {
    return mapHarnessError(err, TAG);
  }
});

harvestRoute.post('/hosts/reload', async (c) => {
  try {
    const res = await harnessClient.post('/harvest/hosts/reload', {}, TIMEOUT);
    return forwardResponse(res, TAG);
  } catch (err) {
    return mapHarnessError(err, TAG);
  }
});

harvestRoute.get('/hosts/:host', async (c) => {
  const host = c.req.param('host');
  try {
    const res = await harnessClient.get(
      `/harvest/hosts/${encodeURIComponent(host)}`,
      TIMEOUT,
    );
    return forwardResponse(res, TAG);
  } catch (err) {
    return mapHarnessError(err, TAG);
  }
});

harvestRoute.patch('/hosts/:host', async (c) => {
  const host = c.req.param('host');
  const body = await readBody(c);
  try {
    const res = await harnessClient.patch(
      `/harvest/hosts/${encodeURIComponent(host)}`,
      body,
      TIMEOUT,
    );
    return forwardResponse(res, TAG);
  } catch (err) {
    return mapHarnessError(err, TAG);
  }
});

harvestRoute.delete('/hosts/:host', async (c) => {
  const host = c.req.param('host');
  try {
    const res = await harnessClient.delete(
      `/harvest/hosts/${encodeURIComponent(host)}`,
      TIMEOUT,
    );
    return forwardResponse(res, TAG);
  } catch (err) {
    return mapHarnessError(err, TAG);
  }
});
