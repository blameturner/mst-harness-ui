import { Hono } from 'hono';
import { z } from 'zod';
import { requireAuth } from '../middleware/requireAuth.js';
import { getAuthContext } from '../lib/auth-context.js';
import { assertInteger } from '../lib/noco-filter.js';
import { FetchTimeoutError } from '../lib/fetch-with-timeout.js';
import {
  getGraphCoverage,
  getSchedulerStatus,
  triggerScheduler,
  listEnrichmentAgents,
  createEnrichmentAgent,
  patchEnrichmentAgent,
  triggerEnrichmentAgent,
  getEnrichmentAgentStatus,
  listEnrichmentSources,
  getEnrichmentSource,
  createEnrichmentSource,
  patchEnrichmentSource,
  deleteEnrichmentSource,
  flushEnrichmentSource,
  getEnrichmentSourceLog,
  listEnrichmentLog,
  listEnrichmentSuggestions,
  getEnrichmentSuggestion,
  patchEnrichmentSuggestion,
  approveEnrichmentSuggestion,
  rejectEnrichmentSuggestion,
} from '../services/harness/index.js';
import type { AuthVariables } from '../types/auth.js';

export const enrichmentRoute = new Hono<{ Variables: AuthVariables }>();

enrichmentRoute.use('*', requireAuth);

const CATEGORIES = [
  'documentation',
  'news',
  'competitive',
  'regulatory',
  'research',
  'security',
  'model_releases',
] as const;
const categoryEnum = z.enum(CATEGORIES);

function mapHarnessError(err: unknown) {
  if (err instanceof FetchTimeoutError) {
    return new Response(JSON.stringify({ error: 'harness_timeout' }), {
      status: 504,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  console.error('[enrichment] harness unreachable', err);
  return new Response(JSON.stringify({ error: 'harness_unreachable' }), {
    status: 502,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function forward(res: Response) {
  const text = await res.text();
  const contentType = res.headers.get('content-type') ?? 'application/json';
  return new Response(text, {
    status: res.status,
    headers: { 'Content-Type': contentType },
  });
}

function parseIdParam(raw: string | undefined): number | null {
  if (raw == null) return null;
  try {
    return assertInteger(raw, 'id');
  } catch {
    return null;
  }
}

// --- Sources ----------------------------------------------------------------

const createSourceSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  category: categoryEnum.optional(),
  frequency_hours: z.number().int().positive().max(24 * 30).optional(),
  active: z.boolean().default(true),
  enrichment_agent_id: z.number().int().nullable().optional(),
  use_playwright: z.boolean().optional(),
  playwright_fallback: z.boolean().optional(),
});

const updateSourceSchema = z.object({
  name: z.string().min(1).optional(),
  url: z.string().url().optional(),
  category: categoryEnum.optional(),
  frequency_hours: z.number().int().positive().max(24 * 30).optional(),
  active: z.boolean().optional(),
  enrichment_agent_id: z.number().int().nullable().optional(),
  use_playwright: z.boolean().optional(),
  playwright_fallback: z.boolean().optional(),
});

enrichmentRoute.get('/sources', async (c) => {
  const { orgId } = getAuthContext(c);
  const url = new URL(c.req.url);
  const agentId = url.searchParams.get('agent_id');
  const activeOnly = url.searchParams.get('active_only');
  try {
    const res = await listEnrichmentSources(Number(orgId), {
      agent_id: agentId ? Number(agentId) : undefined,
      active_only: activeOnly ? activeOnly === 'true' : undefined,
    });
    return forward(res);
  } catch (err) {
    return mapHarnessError(err);
  }
});

enrichmentRoute.get('/sources/:id', async (c) => {
  const id = parseIdParam(c.req.param('id'));
  if (id == null) return c.json({ error: 'invalid_id' }, 400);
  try {
    const res = await getEnrichmentSource(id);
    return forward(res);
  } catch (err) {
    return mapHarnessError(err);
  }
});

enrichmentRoute.post('/sources', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = createSourceSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid_body', issues: parsed.error.issues }, 400);
  }
  const { orgId } = getAuthContext(c);
  try {
    const res = await createEnrichmentSource({ ...parsed.data, org_id: Number(orgId) });
    return forward(res);
  } catch (err) {
    return mapHarnessError(err);
  }
});

enrichmentRoute.patch('/sources/:id', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = updateSourceSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid_body', issues: parsed.error.issues }, 400);
  }
  const id = parseIdParam(c.req.param('id'));
  if (id == null) return c.json({ error: 'invalid_id' }, 400);
  try {
    const res = await patchEnrichmentSource(id, parsed.data);
    return forward(res);
  } catch (err) {
    return mapHarnessError(err);
  }
});

enrichmentRoute.delete('/sources/:id', async (c) => {
  const id = parseIdParam(c.req.param('id'));
  if (id == null) return c.json({ error: 'invalid_id' }, 400);
  try {
    const res = await deleteEnrichmentSource(id);
    return forward(res);
  } catch (err) {
    return mapHarnessError(err);
  }
});

enrichmentRoute.post('/sources/:id/trigger', async (c) => {
  // Per-source trigger not yet in harness — fire a full scheduler cycle.
  try {
    const res = await triggerScheduler();
    return forward(res);
  } catch (err) {
    return mapHarnessError(err);
  }
});

enrichmentRoute.post('/sources/:id/flush', async (c) => {
  const id = parseIdParam(c.req.param('id'));
  if (id == null) return c.json({ error: 'invalid_id' }, 400);
  try {
    const res = await flushEnrichmentSource(id);
    return forward(res);
  } catch (err) {
    return mapHarnessError(err);
  }
});

enrichmentRoute.get('/sources/:id/log', async (c) => {
  const id = parseIdParam(c.req.param('id'));
  if (id == null) return c.json({ error: 'invalid_id' }, 400);
  const url = new URL(c.req.url);
  const limit = Number(url.searchParams.get('limit')) || 50;
  try {
    const res = await getEnrichmentSourceLog(id, limit);
    return forward(res);
  } catch (err) {
    return mapHarnessError(err);
  }
});

// --- Log --------------------------------------------------------------------

enrichmentRoute.get('/log', async (c) => {
  const { orgId } = getAuthContext(c);
  const url = new URL(c.req.url);
  const limit = Number(url.searchParams.get('limit')) || 100;
  try {
    const res = await listEnrichmentLog(Number(orgId), limit);
    return forward(res);
  } catch (err) {
    return mapHarnessError(err);
  }
});

// --- Suggestions ------------------------------------------------------------

enrichmentRoute.get('/suggestions', async (c) => {
  const { orgId } = getAuthContext(c);
  const url = new URL(c.req.url);
  const status = url.searchParams.get('status') ?? undefined;
  try {
    const res = await listEnrichmentSuggestions(Number(orgId), status);
    return forward(res);
  } catch (err) {
    return mapHarnessError(err);
  }
});

enrichmentRoute.get('/suggestions/:id', async (c) => {
  const id = parseIdParam(c.req.param('id'));
  if (id == null) return c.json({ error: 'invalid_id' }, 400);
  try {
    const res = await getEnrichmentSuggestion(id);
    return forward(res);
  } catch (err) {
    return mapHarnessError(err);
  }
});

enrichmentRoute.patch('/suggestions/:id', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: 'invalid_body' }, 400);
  const id = parseIdParam(c.req.param('id'));
  if (id == null) return c.json({ error: 'invalid_id' }, 400);
  try {
    const res = await patchEnrichmentSuggestion(id, body);
    return forward(res);
  } catch (err) {
    return mapHarnessError(err);
  }
});

enrichmentRoute.post('/suggestions/:id/approve', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const id = parseIdParam(c.req.param('id'));
  if (id == null) return c.json({ error: 'invalid_id' }, 400);
  try {
    const res = await approveEnrichmentSuggestion(id, body);
    return forward(res);
  } catch (err) {
    return mapHarnessError(err);
  }
});

enrichmentRoute.post('/suggestions/:id/reject', async (c) => {
  const id = parseIdParam(c.req.param('id'));
  if (id == null) return c.json({ error: 'invalid_id' }, 400);
  try {
    const res = await rejectEnrichmentSuggestion(id);
    return forward(res);
  } catch (err) {
    return mapHarnessError(err);
  }
});

// --- Scheduler proxies ------------------------------------------------------

enrichmentRoute.get('/status', async () => {
  try {
    const res = await getSchedulerStatus();
    return forward(res);
  } catch (err) {
    return mapHarnessError(err);
  }
});

enrichmentRoute.post('/trigger', async () => {
  try {
    const res = await triggerScheduler();
    return forward(res);
  } catch (err) {
    return mapHarnessError(err);
  }
});

enrichmentRoute.get('/graph/coverage', async (c) => {
  const { orgId } = getAuthContext(c);
  try {
    const res = await getGraphCoverage(Number(orgId));
    if (res.status === 404) {
      return c.json({ nodes: [] });
    }
    return forward(res);
  } catch (err) {
    return mapHarnessError(err);
  }
});

// --- Agents -----------------------------------------------------------------

const createAgentSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(''),
  category: z.string().default(''),
  token_budget: z.number().int().positive().default(50000),
  cron_expression: z.string().min(1),
  timezone: z.string().default('Australia/Sydney'),
  active: z.boolean().default(true),
});

enrichmentRoute.get('/agents', async (c) => {
  const { orgId } = getAuthContext(c);
  try {
    const res = await listEnrichmentAgents(Number(orgId));
    return forward(res);
  } catch (err) {
    return mapHarnessError(err);
  }
});

enrichmentRoute.post('/agents', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = createAgentSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'invalid_body', issues: parsed.error.issues }, 400);
  const { orgId } = getAuthContext(c);
  try {
    const res = await createEnrichmentAgent({ ...parsed.data, org_id: Number(orgId) });
    return forward(res);
  } catch (err) {
    return mapHarnessError(err);
  }
});

enrichmentRoute.patch('/agents/:id', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: 'invalid_body' }, 400);
  let id: number;
  try { id = assertInteger(c.req.param('id'), 'agent_id'); } catch { return c.json({ error: 'invalid_id' }, 400); }
  try {
    const res = await patchEnrichmentAgent(id, body);
    return forward(res);
  } catch (err) {
    return mapHarnessError(err);
  }
});

enrichmentRoute.post('/agents/:id/trigger', async (c) => {
  let id: number;
  try { id = assertInteger(c.req.param('id'), 'agent_id'); } catch { return c.json({ error: 'invalid_id' }, 400); }
  try {
    const res = await triggerEnrichmentAgent(id);
    return forward(res);
  } catch (err) {
    return mapHarnessError(err);
  }
});

enrichmentRoute.get('/agents/:id/status', async (c) => {
  let id: number;
  try { id = assertInteger(c.req.param('id'), 'agent_id'); } catch { return c.json({ error: 'invalid_id' }, 400); }
  try {
    const res = await getEnrichmentAgentStatus(id);
    return forward(res);
  } catch (err) {
    return mapHarnessError(err);
  }
});
