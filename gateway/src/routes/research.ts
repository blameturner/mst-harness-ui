import { Hono } from 'hono';
import { z } from 'zod';
import { requireAuth } from '../middleware/requireAuth.js';
import { getAuthContext } from '../lib/auth-context.js';
import { FetchTimeoutError } from '../lib/FetchTimeoutError.js';
import { research as harnessResearch } from '../services/harness/index.js';
import type { AuthVariables } from '../types/AuthVariables.js';

export const researchRoute = new Hono<{ Variables: AuthVariables }>();

researchRoute.use('*', requireAuth);

const researchSchema = z.object({
  model: z.string().min(1),
  question: z.string().min(1),
  conversation_id: z.number().int().positive().optional(),
});

researchRoute.post('/', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = researchSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'invalid_body', issues: parsed.error.issues }, 400);

  const { orgId } = getAuthContext(c);
  const payload = { ...parsed.data, org_id: Number(orgId) };

  try {
    const res = await harnessResearch(payload);
    if (!res.ok) {
      const text = await res.text();
      console.error('[research] harness error', res.status, text);
      return c.json(
        { error: 'harness_error', status: res.status, detail: text.slice(0, 500) },
        502,
      );
    }
    let data: unknown;
    try {
      data = await res.json();
    } catch {
      return c.json({ error: 'harness_error', detail: 'non-JSON response' }, 502);
    }
    return c.json(data);
  } catch (err) {
    if (err instanceof FetchTimeoutError) {
      return c.json({ error: 'harness_timeout' }, 504);
    }
    console.error('[research] harness unreachable', err);
    return c.json({ error: 'harness_unreachable' }, 502);
  }
});
