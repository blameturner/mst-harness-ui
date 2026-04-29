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

export const agentsAdminRoute = new Hono<{ Variables: AuthVariables }>();

agentsAdminRoute.use('*', requireAuth);

agentsAdminRoute.get('/assignments', async (c) => {
  try {
    const res = await harnessClient.get(harnessPathWithOrg(c, '/assignments'), TIMEOUT);
    return forwardResponse(res, 'agents-admin');
  } catch (err) {
    return mapHarnessError(err, 'agents-admin');
  }
});

agentsAdminRoute.post('/assignments', async (c) => {
  const body = await readJsonBody(c);
  if (!body) return c.json({ error: 'invalid_body' }, 400);
  try {
    const res = await harnessClient.post(harnessPathWithOrg(c, '/assignments'), body, TIMEOUT);
    return forwardResponse(res, 'agents-admin');
  } catch (err) {
    return mapHarnessError(err, 'agents-admin');
  }
});

agentsAdminRoute.get('/assignments/:id', async (c) => {
  const id = c.req.param('id');
  try {
    const res = await harnessClient.get(harnessPathWithOrg(c, `/assignments/${encodeURIComponent(id)}`), TIMEOUT);
    return forwardResponse(res, 'agents-admin');
  } catch (err) {
    return mapHarnessError(err, 'agents-admin');
  }
});

agentsAdminRoute.patch('/assignments/:id', async (c) => {
  const id = c.req.param('id');
  const body = await readJsonBody(c);
  if (!body) return c.json({ error: 'invalid_body' }, 400);
  try {
    const res = await harnessClient.patch(
      harnessPathWithOrg(c, `/assignments/${encodeURIComponent(id)}`),
      body,
      TIMEOUT,
    );
    return forwardResponse(res, 'agents-admin');
  } catch (err) {
    return mapHarnessError(err, 'agents-admin');
  }
});

agentsAdminRoute.post('/assignments/:id/cancel', async (c) => {
  const id = c.req.param('id');
  try {
    const res = await harnessClient.post(harnessPathWithOrg(c, `/assignments/${encodeURIComponent(id)}/cancel`), {}, TIMEOUT);
    return forwardResponse(res, 'agents-admin');
  } catch (err) {
    return mapHarnessError(err, 'agents-admin');
  }
});

agentsAdminRoute.post('/assignments/:id/retry', async (c) => {
  const id = c.req.param('id');
  try {
    const res = await harnessClient.post(harnessPathWithOrg(c, `/assignments/${encodeURIComponent(id)}/retry`), {}, TIMEOUT);
    return forwardResponse(res, 'agents-admin');
  } catch (err) {
    return mapHarnessError(err, 'agents-admin');
  }
});

agentsAdminRoute.get('/approvals', async (c) => {
  try {
    const res = await harnessClient.get(harnessPathWithOrg(c, '/approvals'), TIMEOUT);
    return forwardResponse(res, 'agents-admin');
  } catch (err) {
    return mapHarnessError(err, 'agents-admin');
  }
});

agentsAdminRoute.post('/approvals/:id/approve', async (c) => {
  const id = c.req.param('id');
  const body = (await readJsonBody(c)) ?? {};
  try {
    const res = await harnessClient.post(
      harnessPathWithOrg(c, `/approvals/${encodeURIComponent(id)}/approve`),
      body,
      TIMEOUT,
    );
    return forwardResponse(res, 'agents-admin');
  } catch (err) {
    return mapHarnessError(err, 'agents-admin');
  }
});

agentsAdminRoute.post('/approvals/:id/reject', async (c) => {
  const id = c.req.param('id');
  const body = (await readJsonBody(c)) ?? {};
  try {
    const res = await harnessClient.post(
      harnessPathWithOrg(c, `/approvals/${encodeURIComponent(id)}/reject`),
      body,
      TIMEOUT,
    );
    return forwardResponse(res, 'agents-admin');
  } catch (err) {
    return mapHarnessError(err, 'agents-admin');
  }
});

agentsAdminRoute.get('/incidents', async (c) => {
  try {
    const res = await harnessClient.get(harnessPathWithOrg(c, '/incidents'), TIMEOUT);
    return forwardResponse(res, 'agents-admin');
  } catch (err) {
    return mapHarnessError(err, 'agents-admin');
  }
});

agentsAdminRoute.post('/incidents/:id/resolve', async (c) => {
  const id = c.req.param('id');
  const body = (await readJsonBody(c)) ?? {};
  try {
    const res = await harnessClient.post(
      harnessPathWithOrg(c, `/incidents/${encodeURIComponent(id)}/resolve`),
      body,
      TIMEOUT,
    );
    return forwardResponse(res, 'agents-admin');
  } catch (err) {
    return mapHarnessError(err, 'agents-admin');
  }
});

agentsAdminRoute.get('/templates', async (c) => {
  try {
    const res = await harnessClient.get(harnessPathWithOrg(c, '/templates'), TIMEOUT);
    return forwardResponse(res, 'agents-admin');
  } catch (err) {
    return mapHarnessError(err, 'agents-admin');
  }
});

agentsAdminRoute.post('/templates/:id/instantiate', async (c) => {
  const id = c.req.param('id');
  const body = await readJsonBody(c);
  if (!body) return c.json({ error: 'invalid_body' }, 400);
  try {
    const res = await harnessClient.post(
      harnessPathWithOrg(c, `/templates/${encodeURIComponent(id)}/instantiate`),
      body,
      TIMEOUT,
    );
    return forwardResponse(res, 'agents-admin');
  } catch (err) {
    return mapHarnessError(err, 'agents-admin');
  }
});

agentsAdminRoute.get('/artifact-versions', async (c) => {
  try {
    const res = await harnessClient.get(harnessPathWithOrg(c, '/artifact-versions'), TIMEOUT);
    return forwardResponse(res, 'agents-admin');
  } catch (err) {
    return mapHarnessError(err, 'agents-admin');
  }
});

agentsAdminRoute.get('/artifact-versions/:id', async (c) => {
  const id = c.req.param('id');
  try {
    const res = await harnessClient.get(harnessPathWithOrg(c, `/artifact-versions/${encodeURIComponent(id)}`), TIMEOUT);
    return forwardResponse(res, 'agents-admin');
  } catch (err) {
    return mapHarnessError(err, 'agents-admin');
  }
});

agentsAdminRoute.post('/artifact-versions/:id/rollback', async (c) => {
  const id = c.req.param('id');
  try {
    const res = await harnessClient.post(
      harnessPathWithOrg(c, `/artifact-versions/${encodeURIComponent(id)}/rollback`),
      {},
      TIMEOUT,
    );
    return forwardResponse(res, 'agents-admin');
  } catch (err) {
    return mapHarnessError(err, 'agents-admin');
  }
});

agentsAdminRoute.get('/tools/catalog', async (c) => {
  try {
    const res = await harnessClient.get(harnessPathWithOrg(c, '/tools/catalog'), TIMEOUT);
    return forwardResponse(res, 'agents-admin');
  } catch (err) {
    return mapHarnessError(err, 'agents-admin');
  }
});

agentsAdminRoute.get('/nocodb/tables', async (c) => {
  try {
    const res = await harnessClient.get(harnessPathWithOrg(c, '/nocodb/tables'), TIMEOUT);
    return forwardResponse(res, 'agents-admin');
  } catch (err) {
    return mapHarnessError(err, 'agents-admin');
  }
});

