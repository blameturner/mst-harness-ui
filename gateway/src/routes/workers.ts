import { Hono } from 'hono';
import { listAgents, listWorkerTypes } from '../services/harness/index.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { getAuthContext } from '../lib/auth-context.js';
import { FetchTimeoutError } from '../lib/FetchTimeoutError.js';
import type { AuthVariables } from '../types/AuthVariables.js';
import type { HarnessAgent } from '../types/HarnessAgent.js';

export const workersRoute = new Hono<{ Variables: AuthVariables }>();

workersRoute.use('*', requireAuth);

workersRoute.get('/types', async (c) => {
  try {
    const res = await listWorkerTypes();
    if (!res.ok) {
      return c.json({ error: 'harness_error', status: res.status }, 502);
    }
    const body = (await res.json()) as { types?: string[] };
    return c.json({ types: body.types ?? [] });
  } catch (err) {
    if (err instanceof FetchTimeoutError) {
      return c.json({ error: 'harness_timeout' }, 504);
    }
    console.error('[workers] types harness unreachable', err);
    return c.json({ error: 'harness_unreachable' }, 502);
  }
});

workersRoute.get('/', async (c) => {
  const { orgId } = getAuthContext(c);
  const response = await listAgents(orgId);
  if (!response.ok) {
    return c.json({ error: 'Failed to fetch agents from harness' }, 502);
  }
  const data = (await response.json()) as { agents: HarnessAgent[] };
  const workers = data.agents.map((r) => ({
    Id: r.Id,
    name: r.name,
    display_name: r.display_name,
    model: r.model,
  }));
  return c.json({ workers });
});