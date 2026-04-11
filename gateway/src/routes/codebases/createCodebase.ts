import type { Context } from 'hono';
import { z } from 'zod';
import { getAuthContext } from '../../lib/auth-context.js';
import { forwardResponse } from '../../lib/forwardResponse.js';
import { createCodebase as harnessCreateCodebase } from '../../services/harness/index.js';
import { mapCodebasesError } from './mapCodebasesError.js';

const createSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).default(''),
});

export async function createCodebase(c: Context) {
  const body = await c.req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'invalid_body', issues: parsed.error.issues }, 400);
  const { orgId } = getAuthContext(c);
  try {
    const res = await harnessCreateCodebase({ ...parsed.data, org_id: Number(orgId) });
    return forwardResponse(res);
  } catch (err) {
    return mapCodebasesError(err);
  }
}
