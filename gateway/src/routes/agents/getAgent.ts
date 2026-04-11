import type { Context } from 'hono';
import { getAuthContext } from '../../lib/auth-context.js';
import { assertInteger } from '../../lib/assertInteger.js';
import { listAgents as harnessListAgents } from '../../services/harness/index.js';
import { mapAgentsError } from './mapAgentsError.js';
import type { HarnessAgent } from '../../types/HarnessAgent.js';

export async function getAgent(c: Context) {
  const { orgId } = getAuthContext(c);
  let agentId: number;
  try {
    agentId = assertInteger(c.req.param('id'), 'agent_id');
  } catch {
    return c.json({ error: 'invalid_id' }, 400);
  }
  try {
    const res = await harnessListAgents(Number(orgId));
    if (!res.ok) return c.json({ error: 'harness_error', status: res.status }, 502);
    const body = (await res.json()) as { agents: HarnessAgent[] };
    const agent = body.agents.find((a) => a.Id === agentId);
    if (!agent) return c.json({ error: 'not_found' }, 404);
    return c.json(agent);
  } catch (err) {
    return mapAgentsError(err, 'get');
  }
}
