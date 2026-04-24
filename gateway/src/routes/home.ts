import { Hono } from 'hono';
import { requireAuth } from '../middleware/requireAuth.js';
import { getAuthContext } from '../lib/auth-context.js';
import { mapHarnessError } from '../lib/mapHarnessError.js';
import { forwardResponse } from '../lib/forwardResponse.js';
import { harnessClient } from '../services/harness/client.js';
import type { AuthVariables } from '../types/AuthVariables.js';

const TIMEOUT = 30_000;

export const homeRoute = new Hono<{ Variables: AuthVariables }>();

homeRoute.use('*', requireAuth);

function scopedSearch(url: string, orgId: number | string): string {
  const parsedUrl = new URL(url);
  if (!parsedUrl.searchParams.get('org_id')) {
    parsedUrl.searchParams.set('org_id', String(orgId));
  }
  const qs = parsedUrl.searchParams.toString();
  return qs ? `?${qs}` : '';
}

homeRoute.get('/overview', async (c) => {
  const { orgId } = getAuthContext(c);
  const qs = scopedSearch(c.req.url, orgId);
  try {
    const res = await harnessClient.get(`/home/overview${qs}`, TIMEOUT);
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'home');
  }
});

homeRoute.get('/health', async (_c) => {
  try {
    const res = await harnessClient.get('/home/health', TIMEOUT);
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'home');
  }
});

homeRoute.get('/feed', async (c) => {
  const { orgId } = getAuthContext(c);
  const qs = scopedSearch(c.req.url, orgId);
  try {
    const res = await harnessClient.get(`/home/feed${qs}`, TIMEOUT);
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'home');
  }
});

homeRoute.get('/digest', async (c) => {
  const { orgId } = getAuthContext(c);
  const qs = scopedSearch(c.req.url, orgId);
  try {
    const res = await harnessClient.get(`/home/digest${qs}`, TIMEOUT);
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'home');
  }
});

homeRoute.get('/digests', async (c) => {
  const { orgId } = getAuthContext(c);
  const qs = scopedSearch(c.req.url, orgId);
  try {
    const res = await harnessClient.get(`/home/digests${qs}`, TIMEOUT);
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'home');
  }
});

homeRoute.post('/digest/run', async (c) => {
  const body = await c.req.json().catch(() => null);
  const { orgId } = getAuthContext(c);
  const payload = { ...(body ?? {}), org_id: Number((body as any)?.org_id ?? orgId) };
  try {
    const res = await harnessClient.post('/home/digest/run', payload, TIMEOUT);
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'home');
  }
});

homeRoute.post('/digest/:id/feedback', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => null);
  const { orgId } = getAuthContext(c);
  const payload = { ...(body ?? {}), org_id: Number((body as any)?.org_id ?? orgId) };
  try {
    const res = await harnessClient.post(`/home/digest/${encodeURIComponent(id)}/feedback`, payload, TIMEOUT);
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'home');
  }
});

homeRoute.get('/insights', async (c) => {
  const { orgId } = getAuthContext(c);
  const qs = scopedSearch(c.req.url, orgId);
  try {
    const res = await harnessClient.get(`/home/insights${qs}`, TIMEOUT);
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'home');
  }
});

homeRoute.get('/insights/:id', async (c) => {
  const id = c.req.param('id');
  try {
    const res = await harnessClient.get(`/home/insights/${encodeURIComponent(id)}`, TIMEOUT);
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'home');
  }
});

homeRoute.post('/insights/produce', async (c) => {
  const body = await c.req.json().catch(() => null);
  const { orgId } = getAuthContext(c);
  const payload = { ...(body ?? {}), org_id: Number((body as any)?.org_id ?? orgId) };
  try {
    const res = await harnessClient.post('/home/insights/produce', payload, TIMEOUT);
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'home');
  }
});

homeRoute.post('/insights/:id/research', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => null);
  const { orgId } = getAuthContext(c);
  const payload = { ...(body ?? {}), org_id: Number((body as any)?.org_id ?? orgId) };
  try {
    const res = await harnessClient.post(
      `/home/insights/${encodeURIComponent(id)}/research`,
      payload,
      TIMEOUT,
    );
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'home');
  }
});

homeRoute.get('/insights/:id/research', async (c) => {
  const id = c.req.param('id');
  try {
    const res = await harnessClient.get(
      `/home/insights/${encodeURIComponent(id)}/research`,
      TIMEOUT,
    );
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'home');
  }
});

homeRoute.get('/questions', async (c) => {
  const { orgId } = getAuthContext(c);
  const qs = scopedSearch(c.req.url, orgId);
  try {
    const res = await harnessClient.get(`/home/questions${qs}`, TIMEOUT);
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'home');
  }
});

homeRoute.post('/questions/:id/answer', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => null);
  const { orgId } = getAuthContext(c);
  const payload = { ...(body ?? {}), org_id: Number((body as any)?.org_id ?? orgId) };
  try {
    const res = await harnessClient.post(`/home/questions/${encodeURIComponent(id)}/answer`, payload, TIMEOUT);
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'home');
  }
});

homeRoute.post('/questions/:id/dismiss', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => null);
  const { orgId } = getAuthContext(c);
  const payload = { ...(body ?? {}), org_id: Number((body as any)?.org_id ?? orgId) };
  try {
    const res = await harnessClient.post(`/home/questions/${encodeURIComponent(id)}/dismiss`, payload, TIMEOUT);
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'home');
  }
});

homeRoute.post('/questions/:id/retract', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => null);
  const { orgId } = getAuthContext(c);
  const payload = { ...(body ?? {}), org_id: Number((body as any)?.org_id ?? orgId) };
  try {
    const res = await harnessClient.post(`/home/questions/${encodeURIComponent(id)}/retract`, payload, TIMEOUT);
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'home');
  }
});

homeRoute.post('/chat', async (c) => {
  const body = await c.req.json().catch(() => null);
  const { orgId } = getAuthContext(c);
  const payload = { ...(body ?? {}), org_id: Number((body as any)?.org_id ?? orgId) };
  try {
    const res = await harnessClient.post('/home/chat', payload, TIMEOUT);
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'home');
  }
});

homeRoute.post('/briefing', async (c) => {
  const { orgId } = getAuthContext(c);
  const qs = scopedSearch(c.req.url, orgId);
  try {
    const res = await harnessClient.post(`/home/briefing${qs}`, {}, TIMEOUT);
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'home');
  }
});

homeRoute.get('/schedules', async (c) => {
  const { orgId } = getAuthContext(c);
  const qs = scopedSearch(c.req.url, orgId);
  try {
    const res = await harnessClient.get(`/home/schedules${qs}`, TIMEOUT);
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'home');
  }
});

homeRoute.post('/schedules/:id/run-now', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  try {
    const res = await harnessClient.post(`/home/schedules/${encodeURIComponent(id)}/run-now`, body, TIMEOUT);
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'home');
  }
});

homeRoute.get('/widgets/email', async (_c) => {
  try {
    const res = await harnessClient.get('/home/widgets/email', TIMEOUT);
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'home');
  }
});

homeRoute.get('/widgets/calendar', async (_c) => {
  try {
    const res = await harnessClient.get('/home/widgets/calendar', TIMEOUT);
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'home');
  }
});

homeRoute.get('/widgets/graph', async (c) => {
  const { orgId } = getAuthContext(c);
  const qs = scopedSearch(c.req.url, orgId);
  try {
    const res = await harnessClient.get(`/home/widgets/graph${qs}`, TIMEOUT);
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'home');
  }
});

homeRoute.get('/widgets/activity', async (c) => {
  const { orgId } = getAuthContext(c);
  const qs = scopedSearch(c.req.url, orgId);
  try {
    const res = await harnessClient.get(`/home/widgets/activity${qs}`, TIMEOUT);
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'home');
  }
});

homeRoute.post('/search', async (c) => {
  const body = await c.req.json().catch(() => null);
  const { orgId } = getAuthContext(c);
  const payload = { ...(body ?? {}), org_id: Number((body as any)?.org_id ?? orgId) };
  try {
    const res = await harnessClient.post('/home/search', payload, TIMEOUT);
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'home');
  }
});

homeRoute.get('/conversation/export', async (c) => {
  const { orgId } = getAuthContext(c);
  const qs = scopedSearch(c.req.url, orgId);
  try {
    const res = await harnessClient.get(`/home/conversation/export${qs}`, TIMEOUT);
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'home');
  }
});

