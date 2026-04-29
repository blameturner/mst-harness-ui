import type { Context } from 'hono';
import { getAuthContext } from '../../lib/auth-context.js';
import { mapAgentsError } from './mapAgentsError.js';
import { harnessClient } from '../../services/harness/client.js';
import { forwardResponse } from '../../lib/forwardResponse.js';

const TIMEOUT = 30_000;

export async function listAgents(c: Context) {
  const { orgId } = getAuthContext(c);
  try {
    const url = new URL(c.req.url);
    url.searchParams.set('org_id', String(Number(orgId)));
    const qs = url.searchParams.toString();
    const res = await harnessClient.get(`/agents${qs ? `?${qs}` : ''}`, TIMEOUT);
    return forwardResponse(res, 'agents');
  } catch (err) {
    return mapAgentsError(err, 'list');
  }
}
