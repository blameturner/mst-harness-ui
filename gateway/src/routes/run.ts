import { Hono } from 'hono';
import { z } from 'zod';
import { requireAuth } from '../middleware/requireAuth.js';
import { getAuthContext } from '../lib/auth-context.js';
import { FetchTimeoutError } from '../lib/fetch-with-timeout.js';
import { run as harnessRun } from '../services/harness/index.js';
import type { AuthVariables } from '../types/auth.js';

export const runRoute = new Hono<{ Variables: AuthVariables }>();

runRoute.use('*', requireAuth);

const runSchema = z.object({
  agent_name: z.string().min(1),
  task: z.string().min(1),
  product: z.string().default(''),
});

runRoute.post('/', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = runSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'invalid_body', issues: parsed.error.issues }, 400);

  const { orgId } = getAuthContext(c);
  // org_id is injected from the session — the frontend never supplies it.
  const payload = { ...parsed.data, org_id: orgId };

  try {
    const res = await harnessRun(payload);
    const text = await res.text();
    if (!res.ok) {
      console.error('[run] harness error', res.status, text);
      // Do not forward the harness response body — it may contain stack
      // traces, SQL fragments, or internal paths. Status only.
      return c.json({ error: 'harness_error', status: res.status }, 502);
    }
    const contentType = res.headers.get('content-type') ?? 'application/json';
    return new Response(text, { status: res.status, headers: { 'Content-Type': contentType } });
  } catch (err) {
    if (err instanceof FetchTimeoutError) {
      return c.json({ error: 'harness_timeout' }, 504);
    }
    console.error('[run] harness unreachable', err);
    return c.json({ error: 'harness_unreachable' }, 502);
  }
});
