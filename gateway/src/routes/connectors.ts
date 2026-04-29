import { Hono } from 'hono';
import type { Context } from 'hono';
import { requireAuth } from '../middleware/requireAuth.js';
import { getAuthContext } from '../lib/auth-context.js';
import { mapHarnessError } from '../lib/mapHarnessError.js';
import { forwardResponse } from '../lib/forwardResponse.js';
import type { AuthVariables } from '../types/AuthVariables.js';
import { harnessClient } from '../services/harness/client.js';

const TIMEOUT = 30_000;

function harnessPathWithOrg(c: Context, path: string): string {
  const { orgId } = getAuthContext(c);
  const url = new URL(c.req.url);
  url.searchParams.set('org_id', String(Number(orgId)));
  const qs = url.searchParams.toString();
  return `${path}${qs ? `?${qs}` : ''}`;
}

async function readJsonBody(c: Context): Promise<unknown> {
  return c.req.json().catch(() => null);
}

export const connectorsRoute = new Hono<{ Variables: AuthVariables }>();

connectorsRoute.use('*', requireAuth);

connectorsRoute.get('/apis', async (c) => {
  try {
    const res = await harnessClient.get(harnessPathWithOrg(c, '/connectors/apis'), TIMEOUT);
    return forwardResponse(res, 'connectors');
  } catch (err) {
    return mapHarnessError(err, 'connectors');
  }
});

connectorsRoute.post('/apis', async (c) => {
  const body = await readJsonBody(c);
  if (!body) return c.json({ error: 'invalid_body' }, 400);
  try {
    const res = await harnessClient.post(harnessPathWithOrg(c, '/connectors/apis'), body, TIMEOUT);
    return forwardResponse(res, 'connectors');
  } catch (err) {
    return mapHarnessError(err, 'connectors');
  }
});

connectorsRoute.get('/apis/:id', async (c) => {
  const id = c.req.param('id');
  try {
    const res = await harnessClient.get(harnessPathWithOrg(c, `/connectors/apis/${encodeURIComponent(id)}`), TIMEOUT);
    return forwardResponse(res, 'connectors');
  } catch (err) {
    return mapHarnessError(err, 'connectors');
  }
});

connectorsRoute.patch('/apis/:id', async (c) => {
  const id = c.req.param('id');
  const body = await readJsonBody(c);
  if (!body) return c.json({ error: 'invalid_body' }, 400);
  try {
    const res = await harnessClient.patch(
      harnessPathWithOrg(c, `/connectors/apis/${encodeURIComponent(id)}`),
      body,
      TIMEOUT,
    );
    return forwardResponse(res, 'connectors');
  } catch (err) {
    return mapHarnessError(err, 'connectors');
  }
});

connectorsRoute.delete('/apis/:id', async (c) => {
  const id = c.req.param('id');
  try {
    const res = await harnessClient.delete(harnessPathWithOrg(c, `/connectors/apis/${encodeURIComponent(id)}`), TIMEOUT);
    return forwardResponse(res, 'connectors');
  } catch (err) {
    return mapHarnessError(err, 'connectors');
  }
});

connectorsRoute.post('/apis/:id/inspect', async (c) => {
  const id = c.req.param('id');
  try {
    const res = await harnessClient.post(
      harnessPathWithOrg(c, `/connectors/apis/${encodeURIComponent(id)}/inspect`),
      {},
      120_000,
    );
    return forwardResponse(res, 'connectors');
  } catch (err) {
    return mapHarnessError(err, 'connectors');
  }
});

connectorsRoute.post('/apis/:id/test-call', async (c) => {
  const id = c.req.param('id');
  const body = await readJsonBody(c);
  if (!body) return c.json({ error: 'invalid_body' }, 400);
  try {
    const res = await harnessClient.post(
      harnessPathWithOrg(c, `/connectors/apis/${encodeURIComponent(id)}/test-call`),
      body,
      120_000,
    );
    return forwardResponse(res, 'connectors');
  } catch (err) {
    return mapHarnessError(err, 'connectors');
  }
});

connectorsRoute.get('/smtp', async (c) => {
  try {
    const res = await harnessClient.get(harnessPathWithOrg(c, '/connectors/smtp'), TIMEOUT);
    return forwardResponse(res, 'connectors');
  } catch (err) {
    return mapHarnessError(err, 'connectors');
  }
});

connectorsRoute.post('/smtp', async (c) => {
  const body = await readJsonBody(c);
  if (!body) return c.json({ error: 'invalid_body' }, 400);
  try {
    const res = await harnessClient.post(harnessPathWithOrg(c, '/connectors/smtp'), body, TIMEOUT);
    return forwardResponse(res, 'connectors');
  } catch (err) {
    return mapHarnessError(err, 'connectors');
  }
});

connectorsRoute.get('/smtp/:id', async (c) => {
  const id = c.req.param('id');
  try {
    const res = await harnessClient.get(harnessPathWithOrg(c, `/connectors/smtp/${encodeURIComponent(id)}`), TIMEOUT);
    return forwardResponse(res, 'connectors');
  } catch (err) {
    return mapHarnessError(err, 'connectors');
  }
});

connectorsRoute.patch('/smtp/:id', async (c) => {
  const id = c.req.param('id');
  const body = await readJsonBody(c);
  if (!body) return c.json({ error: 'invalid_body' }, 400);
  try {
    const res = await harnessClient.patch(
      harnessPathWithOrg(c, `/connectors/smtp/${encodeURIComponent(id)}`),
      body,
      TIMEOUT,
    );
    return forwardResponse(res, 'connectors');
  } catch (err) {
    return mapHarnessError(err, 'connectors');
  }
});

connectorsRoute.delete('/smtp/:id', async (c) => {
  const id = c.req.param('id');
  try {
    const res = await harnessClient.delete(harnessPathWithOrg(c, `/connectors/smtp/${encodeURIComponent(id)}`), TIMEOUT);
    return forwardResponse(res, 'connectors');
  } catch (err) {
    return mapHarnessError(err, 'connectors');
  }
});

connectorsRoute.post('/smtp/:id/test', async (c) => {
  const id = c.req.param('id');
  try {
    const res = await harnessClient.post(
      harnessPathWithOrg(c, `/connectors/smtp/${encodeURIComponent(id)}/test`),
      {},
      120_000,
    );
    return forwardResponse(res, 'connectors');
  } catch (err) {
    return mapHarnessError(err, 'connectors');
  }
});

connectorsRoute.get('/secrets', async (c) => {
  try {
    const res = await harnessClient.get(harnessPathWithOrg(c, '/connectors/secrets'), TIMEOUT);
    return forwardResponse(res, 'connectors');
  } catch (err) {
    return mapHarnessError(err, 'connectors');
  }
});

connectorsRoute.post('/secrets', async (c) => {
  const body = await readJsonBody(c);
  if (!body) return c.json({ error: 'invalid_body' }, 400);
  try {
    const res = await harnessClient.post(harnessPathWithOrg(c, '/connectors/secrets'), body, TIMEOUT);
    return forwardResponse(res, 'connectors');
  } catch (err) {
    return mapHarnessError(err, 'connectors');
  }
});

connectorsRoute.get('/secrets/:id', async (c) => {
  const id = c.req.param('id');
  try {
    const res = await harnessClient.get(harnessPathWithOrg(c, `/connectors/secrets/${encodeURIComponent(id)}`), TIMEOUT);
    return forwardResponse(res, 'connectors');
  } catch (err) {
    return mapHarnessError(err, 'connectors');
  }
});

connectorsRoute.patch('/secrets/:id', async (c) => {
  const id = c.req.param('id');
  const body = await readJsonBody(c);
  if (!body) return c.json({ error: 'invalid_body' }, 400);
  try {
    const res = await harnessClient.patch(
      harnessPathWithOrg(c, `/connectors/secrets/${encodeURIComponent(id)}`),
      body,
      TIMEOUT,
    );
    return forwardResponse(res, 'connectors');
  } catch (err) {
    return mapHarnessError(err, 'connectors');
  }
});

connectorsRoute.delete('/secrets/:id', async (c) => {
  const id = c.req.param('id');
  try {
    const res = await harnessClient.delete(harnessPathWithOrg(c, `/connectors/secrets/${encodeURIComponent(id)}`), TIMEOUT);
    return forwardResponse(res, 'connectors');
  } catch (err) {
    return mapHarnessError(err, 'connectors');
  }
});

connectorsRoute.post('/secrets/:id/reveal', async (c) => {
  const id = c.req.param('id');
  try {
    const res = await harnessClient.post(
      harnessPathWithOrg(c, `/connectors/secrets/${encodeURIComponent(id)}/reveal`),
      {},
      TIMEOUT,
    );
    return forwardResponse(res, 'connectors');
  } catch (err) {
    return mapHarnessError(err, 'connectors');
  }
});

connectorsRoute.post('/secrets/:id/rotate', async (c) => {
  const id = c.req.param('id');
  const body = await readJsonBody(c);
  if (!body) return c.json({ error: 'invalid_body' }, 400);
  try {
    const res = await harnessClient.post(
      harnessPathWithOrg(c, `/connectors/secrets/${encodeURIComponent(id)}/rotate`),
      body,
      TIMEOUT,
    );
    return forwardResponse(res, 'connectors');
  } catch (err) {
    return mapHarnessError(err, 'connectors');
  }
});

