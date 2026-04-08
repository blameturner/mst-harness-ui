import { Hono } from 'hono';
import { listWhere } from '../services/nocodb/index.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { getAuthContext } from '../lib/auth-context.js';
import { assertInteger, escapeNocoFilter, isValidEmail } from '../lib/noco-filter.js';
import type { AuthVariables } from '../types/auth.js';

export const orgRoute = new Hono<{ Variables: AuthVariables }>();

orgRoute.use('*', requireAuth);

orgRoute.get('/me', async (c) => {
  const { orgId, email } = getAuthContext(c);
  // Defence in depth: these come from the verified session, but we still
  // validate before splicing into NocoDB filter syntax.
  const safeOrgId = assertInteger(orgId, 'orgId');
  if (!isValidEmail(email)) {
    return c.json({ error: 'invalid_session' }, 400);
  }
  const orgs = await listWhere<Record<string, unknown>>(
    'organisations',
    `(Id,eq,${safeOrgId})`,
    1,
  );
  const users = await listWhere<Record<string, unknown>>(
    'users',
    `(email,eq,${escapeNocoFilter(email)})`,
    1,
  );
  return c.json({ org: orgs[0] ?? null, user: users[0] ?? null });
});
