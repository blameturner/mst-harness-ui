import { Hono } from 'hono';
import { requireAuth } from '../middleware/requireAuth.js';
import { getAuthContext } from '../lib/auth-context.js';
import { assertInteger } from '../lib/noco-filter.js';
import { FetchTimeoutError } from '../lib/fetch-with-timeout.js';
import { listAgents } from '../services/harness/index.js';
import { listPage } from '../services/nocodb/index.js';
import type { AuthVariables } from '../types/auth.js';
import type { HarnessAgent } from '../types/harness.js';

export const agentsRoute = new Hono<{ Variables: AuthVariables }>();

agentsRoute.use('*', requireAuth);

type AgentRunRow = {
  Id: number;
  agent_id: number;
  org_id: number;
  status: string;
  summary?: string | null;
  tokens_input?: number | null;
  tokens_output?: number | null;
  context_tokens?: number | null;
  duration_seconds?: number | null;
  quality_score?: number | null;
  model_name?: string | null;
  CreatedAt?: string;
};

type AgentOutputRow = {
  Id: number;
  run_id: number;
  agent_name?: string | null;
  full_text?: string | null;
  CreatedAt?: string;
};

function mapHarnessError(err: unknown, tag: string) {
  if (err instanceof FetchTimeoutError) {
    return new Response(JSON.stringify({ error: 'harness_timeout' }), {
      status: 504,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  console.error(`[agents] ${tag} harness unreachable`, err);
  return new Response(JSON.stringify({ error: 'harness_unreachable' }), {
    status: 502,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** List agents for the caller's org (proxied from harness). */
agentsRoute.get('/', async (c) => {
  const { orgId } = getAuthContext(c);
  try {
    const res = await listAgents(Number(orgId));
    if (!res.ok) {
      return c.json({ error: 'harness_error', status: res.status }, 502);
    }
    const body = (await res.json()) as { agents: HarnessAgent[] };
    return c.json({ agents: body.agents });
  } catch (err) {
    return mapHarnessError(err, 'list');
  }
});

/** Get one agent by id (harness list filtered client-side — harness has no GET /agents/:id). */
agentsRoute.get('/:id', async (c) => {
  const { orgId } = getAuthContext(c);
  let agentId: number;
  try {
    agentId = assertInteger(c.req.param('id'), 'agent_id');
  } catch {
    return c.json({ error: 'invalid_id' }, 400);
  }
  try {
    const res = await listAgents(Number(orgId));
    if (!res.ok) return c.json({ error: 'harness_error', status: res.status }, 502);
    const body = (await res.json()) as { agents: HarnessAgent[] };
    const agent = body.agents.find((a) => a.Id === agentId);
    if (!agent) return c.json({ error: 'not_found' }, 404);
    return c.json(agent);
  } catch (err) {
    return mapHarnessError(err, 'get');
  }
});

/** Runs for one agent — Nocodb-direct, paginated. */
agentsRoute.get('/:id/runs', async (c) => {
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
    const result = await listPage<AgentRunRow>('agent_runs', {
      where: `(agent_id,eq,${agentId})~and(org_id,eq,${Number(orgId)})`,
      limit,
      offset: (page - 1) * limit,
      sort: '-CreatedAt',
    });
    return c.json({
      runs: result.list,
      page,
      limit,
      total: result.pageInfo?.totalRows ?? result.list.length,
    });
  } catch (err) {
    console.error('[agents] list runs failed', err);
    return c.json({ error: 'nocodb_error' }, 502);
  }
});

/** Outputs for one agent — joined via run ownership at the harness level. */
agentsRoute.get('/:id/outputs', async (c) => {
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
});
