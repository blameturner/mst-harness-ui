import type { Context } from 'hono';
import { getAuthContext } from '../../lib/auth-context.js';
import { assertInteger } from '../../lib/assertInteger.js';
import { listPage } from '../../services/nocodb/index.js';
import type { AgentOutputRow } from './types/AgentOutputRow.js';

export async function listAgentOutputs(c: Context) {
  const { orgId } = getAuthContext(c);
  let agentId: number;
  try {
    agentId = assertInteger(c.req.param('id'), 'agent_id');
  } catch {
    return c.json({ error: 'invalid_id' }, 400);
  }
  const url = new URL(c.req.url);
  const page = Math.max(1, Number(url.searchParams.get('page') ?? '1') || 1);
  const limit = Math.min(
    200,
    Math.max(1, Number(url.searchParams.get('limit') ?? '50') || 50),
  );

  try {
    // agent_outputs joins via run_id; we filter on the denormalised agent_id
    // if present, else fall back to org-scoped scan.
    const result = await listPage<AgentOutputRow>('agent_outputs', {
      where: `(org_id,eq,${Number(orgId)})~and(agent_id,eq,${agentId})`,
      limit,
      offset: (page - 1) * limit,
      sort: '-CreatedAt',
    });
    return c.json({
      outputs: result.list,
      page,
      limit,
      total: result.pageInfo?.totalRows ?? result.list.length,
    });
  } catch (err) {
    console.error('[agents] list outputs failed', err);
    return c.json({ error: 'nocodb_error' }, 502);
  }
}
