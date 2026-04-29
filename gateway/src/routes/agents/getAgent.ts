import type { Context } from 'hono';
import { getAuthContext } from '../../lib/auth-context.js';
import { assertInteger } from '../../lib/assertInteger.js';
import { mapAgentsError } from './mapAgentsError.js';
import { harnessClient } from '../../services/harness/client.js';
import { forwardResponse } from '../../lib/forwardResponse.js';

const TIMEOUT = 30_000;

export async function getAgent(c: Context) {
  const { orgId } = getAuthContext(c);
  let agentId: number;
  try {
    agentId = assertInteger(c.req.param('id'), 'agent_id');
  } catch {
    return c.json({ error: 'invalid_id' }, 400);
  }
  try {
    const res = await harnessClient.get(`/agents/${agentId}?org_id=${Number(orgId)}`, TIMEOUT);
    return forwardResponse(res, 'agents');
  } catch (err) {
    return mapAgentsError(err, 'get');
  }
}
