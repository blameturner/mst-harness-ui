import { Hono } from 'hono';
import { listWhere } from '../services/nocodb/index.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { getAuthContext } from '../lib/auth-context.js';
import type { AuthVariables } from '../types/auth.js';

export const orgRoute = new Hono<{ Variables: AuthVariables }>();

orgRoute.use('*', requireAuth);

orgRoute.get('/me', async (c) => {
  const { orgId, email } = getAuthContext(c);
  const orgs = await listWhere<Record<string, unknown>>('organisations', `(Id,eq,${orgId})`, 1);
  const users = await listWhere<Record<string, unknown>>('users', `(email,eq,${email})`, 1);
  return c.json({ org: orgs[0] ?? null, user: users[0] ?? null });
});
