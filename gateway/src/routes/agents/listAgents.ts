import type { Context } from 'hono';
import { getAuthContext } from '../../lib/auth-context.js';
import { listAgents as harnessListAgents } from '../../services/harness/index.js';
import { mapAgentsError } from './mapAgentsError.js';
import type { HarnessAgent } from '../../types/HarnessAgent.js';

export async function listAgents(c: Context) {
  const { orgId } = getAuthContext(c);
  try {
    const res = await harnessListAgents(Number(orgId));
    if (!res.ok) {
      return c.json({ error: 'harness_error', status: res.status }, 502);
    }
    const body = (await res.json()) as { agents: HarnessAgent[] };
    return c.json({ agents: body.agents });
  } catch (err) {
    return mapAgentsError(err, 'list');
  }
}
