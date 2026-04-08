import { Hono } from 'hono';
import { listWhere } from '../services/nocodb/index.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { getAuthContext } from '../lib/auth-context.js';
import type { AuthVariables } from '../types/auth.js';

export const workersRoute = new Hono<{ Variables: AuthVariables }>();

workersRoute.use('*', requireAuth);

interface WorkerRow {
  Id: number;
  name: string;
  display_name: string;
  model: string;
  agent_type: string;
  status: string;
}

workersRoute.get('/', async (c) => {
  const { orgId } = getAuthContext(c);
  // Soft-delete filter is applied automatically by listWhere for the "workers" table.
  const rows = await listWhere<WorkerRow>(
    'workers',
    `(org_id,eq,${orgId})~and(status,eq,active)`,
    200,
  );
  const workers = rows.map((r) => ({
    Id: r.Id,
    name: r.name,
    display_name: r.display_name,
    model: r.model,
    agent_type: r.agent_type,
  }));
  return c.json({ workers });
});
