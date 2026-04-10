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

/**
 * The harness returns rows with NocoDB-style `Id` (capital I) and `CreatedAt`/`UpdatedAt`.
 * The frontend expects lowercase `id`. This normalizer maps the key fields so
 * the frontend doesn't need to know about the backend casing.
 */
function normaliseSource(row: Record<string, unknown>) {
  return {
    id: row.Id ?? row.id,
    org_id: row.org_id,
    name: row.name,
    url: row.url,
    category: row.category,
    frequency_hours: row.frequency_hours,
    last_scraped_at: row.last_scraped_at ?? null,
    status: row.status ?? null,
    chunk_count: row.chunk_count ?? 0,
    content_hash: row.content_hash ?? null,
    active: row.active === true || row.active === 1 || row.active === '1' || row.active === 'true',
    enrichment_agent_id: row.enrichment_agent_id ?? null,
    use_playwright: row.use_playwright === true || row.use_playwright === 1,
    playwright_fallback: row.playwright_fallback === true || row.playwright_fallback === 1,
  };
}

function normaliseSuggestion(row: Record<string, unknown>) {
  return {
    id: row.Id ?? row.id,
    org_id: row.org_id,
    url: row.url,
    name: row.name,
    category: row.category,
    reason: row.reason ?? null,
    confidence: row.confidence,
    confidence_score: row.confidence_score,
    suggested_by_url: row.suggested_by_url ?? null,
    suggested_by_cycle: row.suggested_by_cycle ?? null,
    times_suggested: row.times_suggested ?? 1,
    status: row.status,
    reviewed_by_user_id: row.reviewed_by_user_id ?? null,
    reviewed_at: row.reviewed_at ?? null,
  };
}

function normaliseLogEntry(row: Record<string, unknown>) {
  const flags = row.flags;
  let parsedFlags: string[] = [];
  if (Array.isArray(flags)) parsedFlags = flags.map(String);
  else if (typeof flags === 'string') {
    try { parsedFlags = JSON.parse(flags); } catch { parsedFlags = []; }
  }
  return {
    id: row.Id ?? row.id,
    org_id: row.org_id,
    scrape_target_id: row.scrape_target_id ?? null,
    cycle_id: row.cycle_id,
    event_type: row.event_type,
    source_url: row.source_url ?? null,
    message: row.message ?? null,
    chunks_stored: row.chunks_stored ?? null,
    tokens_used: row.tokens_used ?? null,
    duration_seconds: row.duration_seconds ?? null,
    flags: parsedFlags,
    created_at: row.CreatedAt ?? row.created_at ?? null,
  };
}

/** Forward a harness response, transforming the JSON body with a mapper. */
async function forwardNormalised<T>(
  res: Response,
  transform: (body: Record<string, unknown>) => T,
): Promise<Response> {
  const text = await res.text();
  if (!res.ok) {
    return new Response(text, {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('content-type') ?? 'application/json' },
    });
  }
  try {
    const json = JSON.parse(text);
    const transformed = transform(json);
    return new Response(JSON.stringify(transformed), {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(text, {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('content-type') ?? 'application/json' },
    });
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
    return forwardNormalised(res, (body) => {
      const sources = Array.isArray(body.sources) ? body.sources : Array.isArray(body) ? body : [];
      return { sources: sources.map((s: Record<string, unknown>) => normaliseSource(s)) };
    });
  } catch (err) {
    return mapHarnessError(err);
  }
});

enrichmentRoute.get('/sources/:id', async (c) => {
  const id = parseIdParam(c.req.param('id'));
  if (id == null) return c.json({ error: 'invalid_id' }, 400);
  try {
    const res = await getEnrichmentSource(id);
    return forwardNormalised(res, (body) => normaliseSource(body));
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
    return forwardNormalised(res, (body) => normaliseSource(body));
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
    return forwardNormalised(res, (body) => normaliseSource(body));
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
    return forwardNormalised(res, (body) => {
      const entries = Array.isArray(body.entries) ? body.entries
        : Array.isArray(body.logs) ? body.logs
        : Array.isArray(body.log) ? body.log
        : Array.isArray(body) ? body : [];
      return { entries: entries.map((e: Record<string, unknown>) => normaliseLogEntry(e)) };
    });
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
    return forwardNormalised(res, (body) => {
      const entries = Array.isArray(body.entries) ? body.entries
        : Array.isArray(body.logs) ? body.logs
        : Array.isArray(body.log) ? body.log
        : Array.isArray(body) ? body : [];
      return { entries: entries.map((e: Record<string, unknown>) => normaliseLogEntry(e)) };
    });
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
    return forwardNormalised(res, (body) => {
      const suggestions = Array.isArray(body.suggestions) ? body.suggestions : Array.isArray(body) ? body : [];
      return { suggestions: suggestions.map((s: Record<string, unknown>) => normaliseSuggestion(s)) };
    });
  } catch (err) {
    return mapHarnessError(err);
  }
});

enrichmentRoute.get('/suggestions/:id', async (c) => {
  const id = parseIdParam(c.req.param('id'));
  if (id == null) return c.json({ error: 'invalid_id' }, 400);
  try {
    const res = await getEnrichmentSuggestion(id);
    return forwardNormalised(res, (body) => normaliseSuggestion(body));
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
