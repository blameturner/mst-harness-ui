import { Hono } from 'hono';
import { z } from 'zod';
import { requireAuth } from '../middleware/requireAuth.js';
import { getAuthContext } from '../lib/auth-context.js';
import { FetchTimeoutError } from '../lib/fetch-with-timeout.js';
import { forwardResponse } from '../lib/forwardResponse.js';
import {
  listCodebases,
  createCodebase,
  indexCodebase,
} from '../services/harness/index.js';
import { assertInteger } from '../lib/noco-filter.js';
import type { AuthVariables } from '../types/auth.js';

export const codebasesRoute = new Hono<{ Variables: AuthVariables }>();

codebasesRoute.use('*', requireAuth);

function mapErr(err: unknown) {
  if (err instanceof FetchTimeoutError) return new Response(JSON.stringify({ error: 'harness_timeout' }), { status: 504, headers: { 'Content-Type': 'application/json' } });
  console.error('[codebases] harness unreachable', err);
  return new Response(JSON.stringify({ error: 'harness_unreachable' }), { status: 502, headers: { 'Content-Type': 'application/json' } });
}

codebasesRoute.get('/', async (c) => {
  const { orgId } = getAuthContext(c);
  try {
    const res = await listCodebases(Number(orgId));
    return forwardResponse(res);
  } catch (err) {
    return mapErr(err);
  }
});

const createSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).default(''),
});

codebasesRoute.post('/', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'invalid_body', issues: parsed.error.issues }, 400);
  const { orgId } = getAuthContext(c);
  try {
    const res = await createCodebase({ ...parsed.data, org_id: Number(orgId) });
    return forwardResponse(res);
  } catch (err) {
    return mapErr(err);
  }
});

const indexSchema = z.object({
  files: z.array(z.object({
    name: z.string().min(1),
    content: z.string().optional(),
    content_b64: z.string().optional(),
  })).min(1).max(500),
});

codebasesRoute.post('/:id/index', async (c) => {
  let id: number;
  try { id = assertInteger(c.req.param('id'), 'codebase_id'); } catch { return c.json({ error: 'invalid_id' }, 400); }
  const body = await c.req.json().catch(() => null);
  const parsed = indexSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'invalid_body', issues: parsed.error.issues }, 400);
  try {
    const res = await indexCodebase(id, parsed.data);
    return forwardResponse(res);
  } catch (err) {
    return mapErr(err);
  }
});
