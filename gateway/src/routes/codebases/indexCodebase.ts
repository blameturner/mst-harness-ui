import type { Context } from 'hono';
import { z } from 'zod';
import { getAuthContext } from '../../lib/auth-context.js';
import { forwardResponse } from '../../lib/forwardResponse.js';
import { assertInteger } from '../../lib/assertInteger.js';
import { indexCodebase as harnessIndexCodebase } from '../../services/harness/index.js';
import { mapCodebasesError } from './mapCodebasesError.js';

const indexSchema = z.object({
  files: z.array(z.object({
    name: z.string().min(1),
    content: z.string().optional(),
    content_b64: z.string().optional(),
  })).min(1).max(500),
});

export async function indexCodebase(c: Context) {
  const { orgId } = getAuthContext(c);
  let id: number;
  try { id = assertInteger(c.req.param('id'), 'codebase_id'); } catch { return c.json({ error: 'invalid_id' }, 400); }
  const body = await c.req.json().catch(() => null);
  const parsed = indexSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'invalid_body', issues: parsed.error.issues }, 400);
  try {
    const res = await harnessIndexCodebase(id, Number(orgId), parsed.data);
    return forwardResponse(res);
  } catch (err) {
    return mapCodebasesError(err);
  }
}
