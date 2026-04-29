import { Hono } from 'hono';
import type { Context } from 'hono';
import { requireAuth } from '../../middleware/requireAuth.js';
import { getAuthContext } from '../../lib/auth-context.js';
import { mapHarnessError } from '../../lib/mapHarnessError.js';
import { forwardResponse } from '../../lib/forwardResponse.js';
import { harnessClient } from '../../services/harness/client.js';
import type { AuthVariables } from '../../types/AuthVariables.js';
import { listAgents } from './listAgents.js';
import { getAgent } from './getAgent.js';
import { listAgentRuns } from './listAgentRuns.js';
import { listAgentOutputs } from './listAgentOutputs.js';

export const agentsRoute = new Hono<{ Variables: AuthVariables }>();

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

agentsRoute.use('*', requireAuth);

agentsRoute.get('/', listAgents);
agentsRoute.post('/', async (c) => {
  const body = await readJsonBody(c);
  if (!body) return c.json({ error: 'invalid_body' }, 400);
  try {
	const res = await harnessClient.post(harnessPathWithOrg(c, '/agents'), body, TIMEOUT);
	return forwardResponse(res, 'agents');
  } catch (err) {
	return mapHarnessError(err, 'agents');
  }
});

agentsRoute.get('/:id', getAgent);
agentsRoute.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await readJsonBody(c);
  if (!body) return c.json({ error: 'invalid_body' }, 400);
  try {
	const res = await harnessClient.patch(harnessPathWithOrg(c, `/agents/${encodeURIComponent(id)}`), body, TIMEOUT);
	return forwardResponse(res, 'agents');
  } catch (err) {
	return mapHarnessError(err, 'agents');
  }
});
agentsRoute.delete('/:id', async (c) => {
  const id = c.req.param('id');
  try {
	const res = await harnessClient.delete(harnessPathWithOrg(c, `/agents/${encodeURIComponent(id)}`), TIMEOUT);
	return forwardResponse(res, 'agents');
  } catch (err) {
	return mapHarnessError(err, 'agents');
  }
});

agentsRoute.post('/:id/run', async (c) => {
  const id = c.req.param('id');
  const body = (await readJsonBody(c)) ?? {};
  try {
	const res = await harnessClient.post(harnessPathWithOrg(c, `/agents/${encodeURIComponent(id)}/run`), body, TIMEOUT);
	return forwardResponse(res, 'agents');
  } catch (err) {
	return mapHarnessError(err, 'agents');
  }
});
agentsRoute.post('/:id/pause', async (c) => {
  const id = c.req.param('id');
  const body = (await readJsonBody(c)) ?? {};
  try {
	const res = await harnessClient.post(harnessPathWithOrg(c, `/agents/${encodeURIComponent(id)}/pause`), body, TIMEOUT);
	return forwardResponse(res, 'agents');
  } catch (err) {
	return mapHarnessError(err, 'agents');
  }
});
agentsRoute.post('/:id/resume', async (c) => {
  const id = c.req.param('id');
  try {
	const res = await harnessClient.post(harnessPathWithOrg(c, `/agents/${encodeURIComponent(id)}/resume`), {}, TIMEOUT);
	return forwardResponse(res, 'agents');
  } catch (err) {
	return mapHarnessError(err, 'agents');
  }
});
agentsRoute.post('/:id/reset-circuit', async (c) => {
  const id = c.req.param('id');
  try {
	const res = await harnessClient.post(
	  harnessPathWithOrg(c, `/agents/${encodeURIComponent(id)}/reset-circuit`),
	  {},
	  TIMEOUT,
	);
	return forwardResponse(res, 'agents');
  } catch (err) {
	return mapHarnessError(err, 'agents');
  }
});
agentsRoute.post('/:id/reset-counters', async (c) => {
  const id = c.req.param('id');
  try {
	const res = await harnessClient.post(
	  harnessPathWithOrg(c, `/agents/${encodeURIComponent(id)}/reset-counters`),
	  {},
	  TIMEOUT,
	);
	return forwardResponse(res, 'agents');
  } catch (err) {
	return mapHarnessError(err, 'agents');
  }
});
agentsRoute.post('/:id/clone', async (c) => {
  const id = c.req.param('id');
  const body = await readJsonBody(c);
  if (!body) return c.json({ error: 'invalid_body' }, 400);
  try {
	const res = await harnessClient.post(harnessPathWithOrg(c, `/agents/${encodeURIComponent(id)}/clone`), body, TIMEOUT);
	return forwardResponse(res, 'agents');
  } catch (err) {
	return mapHarnessError(err, 'agents');
  }
});
agentsRoute.post('/:id/test-prompt', async (c) => {
  const id = c.req.param('id');
  const body = await readJsonBody(c);
  if (!body) return c.json({ error: 'invalid_body' }, 400);
  try {
	const res = await harnessClient.post(
	  harnessPathWithOrg(c, `/agents/${encodeURIComponent(id)}/test-prompt`),
	  body,
	  120_000,
	);
	return forwardResponse(res, 'agents');
  } catch (err) {
	return mapHarnessError(err, 'agents');
  }
});

agentsRoute.get('/:id/runs', listAgentRuns);
agentsRoute.get('/:id/runs/:runId', async (c) => {
  const id = c.req.param('id');
  const runId = c.req.param('runId');
  try {
	const res = await harnessClient.get(
	  harnessPathWithOrg(c, `/agents/${encodeURIComponent(id)}/runs/${encodeURIComponent(runId)}`),
	  TIMEOUT,
	);
	return forwardResponse(res, 'agents');
  } catch (err) {
	return mapHarnessError(err, 'agents');
  }
});
agentsRoute.get('/:id/assignments', async (c) => {
  const id = c.req.param('id');
  try {
	const res = await harnessClient.get(
	  harnessPathWithOrg(c, `/agents/${encodeURIComponent(id)}/assignments`),
	  TIMEOUT,
	);
	return forwardResponse(res, 'agents');
  } catch (err) {
	return mapHarnessError(err, 'agents');
  }
});
agentsRoute.get('/:id/artifacts/versions', async (c) => {
  const id = c.req.param('id');
  try {
	const res = await harnessClient.get(
	  harnessPathWithOrg(c, `/agents/${encodeURIComponent(id)}/artifacts/versions`),
	  TIMEOUT,
	);
	return forwardResponse(res, 'agents');
  } catch (err) {
	return mapHarnessError(err, 'agents');
  }
});
agentsRoute.get('/:id/outputs', listAgentOutputs);
