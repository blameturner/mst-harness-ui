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

export const queueRoute = new Hono<{ Variables: AuthVariables }>();

queueRoute.use('*', requireAuth);

queueRoute.post('/submit', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: 'invalid_body' }, 400);
  const { orgId } = getAuthContext(c);
  try {
    const res = await harnessClient.post('/queue/submit', { ...body, org_id: Number(orgId) }, TIMEOUT);
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'queue');
  }
});

queueRoute.get('/status', async (c) => {
  try {
    const res = await harnessClient.get('/queue/status', TIMEOUT);
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'queue');
  }
});

queueRoute.get('/jobs', async (c) => {
  try {
    const res = await harnessClient.get('/queue/jobs', TIMEOUT);
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'queue');
  }
});

queueRoute.get('/jobs/:id', async (c) => {
  const id = c.req.param('id');
  try {
    const res = await harnessClient.get(`/queue/jobs/${encodeURIComponent(id)}`, TIMEOUT);
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'queue');
  }
});

queueRoute.delete('/jobs/:id', async (c) => {
  const id = c.req.param('id');
  try {
    const res = await harnessClient.delete(`/queue/jobs/${encodeURIComponent(id)}`, TIMEOUT);
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'queue');
  }
});

const prioritySchema = z.object({ priority: z.number().int().min(1).max(5) });

queueRoute.patch('/jobs/:id/priority', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => null);
  const parsed = prioritySchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'invalid_body', issues: parsed.error.issues }, 400);
  try {
    const res = await harnessClient.patch(
      `/queue/jobs/${encodeURIComponent(id)}/priority`,
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
  try {
    const res = await harnessClient.post(`/queue/jobs/${encodeURIComponent(id)}/cancel`, {}, TIMEOUT);
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'queue');
  }
});

queueRoute.get('/events', async (c) => {
  const url = `${env.HARNESS_URL}/queue/events`;
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
