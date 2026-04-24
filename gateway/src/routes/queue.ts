import { Hono } from 'hono';
import { z } from 'zod';
import { requireAuth } from '../middleware/requireAuth.js';
import { getAuthContext } from '../lib/auth-context.js';
import { mapHarnessError } from '../lib/mapHarnessError.js';
import { forwardResponse } from '../lib/forwardResponse.js';
import { env } from '../env.js';
import type { AuthVariables } from '../types/AuthVariables.js';
import { harnessClient } from '../services/harness/client.js';

const TIMEOUT = 15_000;

function searchFromUrl(url: string) {
  return new URL(url).search;
}

export const queueRoute = new Hono<{ Variables: AuthVariables }>();

queueRoute.use('*', requireAuth);

queueRoute.post('/submit', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: 'invalid_body' }, 400);
  const { orgId } = getAuthContext(c);
  try {
    const res = await harnessClient.post('/tool-queue/submit', { ...body, org_id: Number(orgId) }, TIMEOUT);
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'queue');
  }
});

queueRoute.get('/active', async (c) => {
  const qs = searchFromUrl(c.req.url);
  try {
    const res = await harnessClient.get(`/tool-queue/active${qs}`, TIMEOUT);
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'queue');
  }
});

queueRoute.get('/status', async (c) => {
  const qs = searchFromUrl(c.req.url);
  try {
    const res = await harnessClient.get(`/tool-queue/status${qs}`, TIMEOUT);
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'queue');
  }
});

queueRoute.get('/runtime', async (c) => {
  const qs = searchFromUrl(c.req.url);
  try {
    const res = await harnessClient.get(`/tool-queue/runtime${qs}`, TIMEOUT);
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'queue');
  }
});

queueRoute.get('/dashboard', async (c) => {
  const qs = searchFromUrl(c.req.url);
  try {
    const res = await harnessClient.get(`/tool-queue/dashboard${qs}`, TIMEOUT);
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'queue');
  }
});

queueRoute.get('/jobs', async (c) => {
  const qs = searchFromUrl(c.req.url);
  try {
    const res = await harnessClient.get(`/tool-queue/jobs${qs}`, TIMEOUT);
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'queue');
  }
});

queueRoute.get('/jobs/:id', async (c) => {
  const id = c.req.param('id');
  const qs = searchFromUrl(c.req.url);
  try {
    const res = await harnessClient.get(`/tool-queue/jobs/${encodeURIComponent(id)}${qs}`, TIMEOUT);
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'queue');
  }
});

queueRoute.delete('/jobs/:id', async (c) => {
  const id = c.req.param('id');
  const qs = searchFromUrl(c.req.url);
  try {
    const res = await harnessClient.delete(`/tool-queue/jobs/${encodeURIComponent(id)}${qs}`, TIMEOUT);
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'queue');
  }
});

const prioritySchema = z.object({ priority: z.number().int().min(1).max(5) });

queueRoute.patch('/jobs/:id/priority', async (c) => {
  const id = c.req.param('id');
  const qs = searchFromUrl(c.req.url);
  const body = await c.req.json().catch(() => null);
  const parsed = prioritySchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'invalid_body', issues: parsed.error.issues }, 400);
  try {
    const res = await harnessClient.patch(
      `/tool-queue/jobs/${encodeURIComponent(id)}/priority${qs}`,
      parsed.data,
      TIMEOUT,
    );
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'queue');
  }
});

queueRoute.post('/jobs/:id/cancel', async (c) => {
  const id = c.req.param('id');
  const qs = searchFromUrl(c.req.url);
  try {
    const res = await harnessClient.post(`/tool-queue/jobs/${encodeURIComponent(id)}/cancel${qs}`, {}, TIMEOUT);
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'queue');
  }
});

queueRoute.post('/jobs/:id/retry', async (c) => {
  const id = c.req.param('id');
  const qs = searchFromUrl(c.req.url);
  try {
    const res = await harnessClient.post(
      `/tool-queue/jobs/${encodeURIComponent(id)}/retry${qs}`,
      {},
      TIMEOUT,
    );
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'queue');
  }
});

queueRoute.post('/jobs/:id/run-now', async (c) => {
  const id = c.req.param('id');
  const qs = searchFromUrl(c.req.url);
  try {
    const res = await harnessClient.post(
      `/tool-queue/jobs/${encodeURIComponent(id)}/run-now${qs}`,
      {},
      TIMEOUT,
    );
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'queue');
  }
});

queueRoute.get('/events', async (c) => {
  const qs = searchFromUrl(c.req.url);
  const url = `${env.HARNESS_URL}/tool-queue/events${qs}`;
  try {
    const res = await fetch(url, { method: 'GET' });
    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => '');
      return c.json({ error: 'harness_error', status: res.status, detail: text.slice(0, 500) }, 502);
    }
    return new Response(res.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (err) {
    console.error('[queue] harness unreachable', err);
    return c.json({ error: 'harness_unreachable' }, 502);
  }
});
