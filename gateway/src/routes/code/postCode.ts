import type { Context } from 'hono';
import { getAuthContext } from '../../lib/auth-context.js';
import { FetchTimeoutError } from '../../lib/FetchTimeoutError.js';
import { code as harnessCode } from '../../services/harness/index.js';
import { codeSchema } from './schemas/codeSchema.js';

export async function postCode(c: Context) {
  const body = await c.req.json().catch(() => null);
  const parsed = codeSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'invalid_body', issues: parsed.error.issues }, 400);

  const { orgId } = getAuthContext(c);
  const payload = { ...parsed.data, org_id: Number(orgId) };

  try {
    const res = await harnessCode(payload);
    if (!res.ok) {
      const text = await res.text();
      console.error('[code] harness error', res.status, text);
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
    console.error('[code] harness unreachable', err);
    return c.json({ error: 'harness_unreachable' }, 502);
  }
}
