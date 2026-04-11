import type { Context, Next } from 'hono';
import { auth } from '../auth/auth.js';
import { getOrgIdForUser } from '../auth/getOrgIdForUser.js';
import type { AuthVariables } from '../types/AuthVariables.js';

export async function requireAuth(c: Context<{ Variables: AuthVariables }>, next: Next) {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) {
    return c.json({ error: 'unauthorized' }, 401);
  }
  const orgId = (session.user as any).orgId ?? (await getOrgIdForUser(session.user.id));
  if (!orgId) {
    return c.json({ error: 'no_org' }, 403);
  }
  c.set('userId', session.user.id);
  c.set('orgId', orgId);
  c.set('email', session.user.email);
  await next();
}
