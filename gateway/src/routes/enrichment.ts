import { Hono } from 'hono';
import { z } from 'zod';
import { requireAuth } from '../middleware/requireAuth.js';
import { getAuthContext } from '../lib/auth-context.js';
import { assertInteger, escapeNocoFilter } from '../lib/noco-filter.js';
import { FetchTimeoutError } from '../lib/fetch-with-timeout.js';
import {
  createRow,
  listPage,
  listWhere,
  patchRow,
} from '../services/nocodb';
import {
  getGraphCoverage,
  getSchedulerStatus,
  triggerScheduler,
} from '../services/harness';
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

const EVENT_TYPES = [
  'cycle_start',
  'cycle_end',
  'source_scraped',
  'source_unchanged',
  'source_rejected',
  'source_error',
  'suggestion_generated',
  'proactive_search',
  'budget_exhausted',
  'deferred',
] as const;

type ScrapeTargetRow = {
  Id: number;
  org_id: number;
  name: string;
  url: string;
  category: (typeof CATEGORIES)[number];
  frequency_hours: number;
  last_scraped_at: string | null;
  status: string | null;
  chunk_count: number | null;
  content_hash: string | null;
  active: boolean | number | null;
};

type EnrichmentLogRow = {
  Id: number;
  org_id: number;
  scrape_target_id: number | null;
  cycle_id: string;
  event_type: (typeof EVENT_TYPES)[number];
  source_url: string | null;
  message: string | null;
  chunks_stored: number | null;
  tokens_used: number | null;
  duration_seconds: number | null;
  flags: string | null;
  CreatedAt?: string;
};

type SuggestionRow = {
  Id: number;
  org_id: number;
  url: string;
  name: string;
  category: (typeof CATEGORIES)[number];
  reason: string | null;
  confidence: 'high' | 'medium' | 'low';
  confidence_score: number;
  suggested_by_url: string | null;
  suggested_by_cycle: number | null;
  times_suggested: number | null;
  status: 'pending' | 'approved' | 'rejected' | 'already_exists';
  reviewed_by_user_id: number | null;
  reviewed_at: string | null;
};

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

function toBool(v: unknown): boolean {
  return v === true || v === 1 || v === '1' || v === 'true';
}

function parseFlags(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function normaliseSource(row: ScrapeTargetRow) {
  return {
    id: row.Id,
    org_id: row.org_id,
    name: row.name,
    url: row.url,
    category: row.category,
    frequency_hours: row.frequency_hours,
    last_scraped_at: row.last_scraped_at,
    status: row.status,
    chunk_count: row.chunk_count ?? 0,
    content_hash: row.content_hash,
    active: toBool(row.active),
  };
}

function normaliseLogEntry(row: EnrichmentLogRow) {
  return {
    id: row.Id,
    org_id: row.org_id,
    scrape_target_id: row.scrape_target_id,
    cycle_id: row.cycle_id,
    event_type: row.event_type,
    source_url: row.source_url,
    message: row.message,
    chunks_stored: row.chunks_stored,
    tokens_used: row.tokens_used,
    duration_seconds: row.duration_seconds,
    flags: parseFlags(row.flags),
    created_at: row.CreatedAt ?? null,
  };
}

function normaliseSuggestion(row: SuggestionRow) {
  return {
    id: row.Id,
    org_id: row.org_id,
    url: row.url,
    name: row.name,
    category: row.category,
    reason: row.reason,
    confidence: row.confidence,
    confidence_score: row.confidence_score,
    suggested_by_url: row.suggested_by_url,
    suggested_by_cycle: row.suggested_by_cycle,
    times_suggested: row.times_suggested ?? 1,
    status: row.status,
    reviewed_by_user_id: row.reviewed_by_user_id,
    reviewed_at: row.reviewed_at,
  };
}

// --- Sources ----------------------------------------------------------------

const createSourceSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  category: categoryEnum,
  frequency_hours: z.number().int().positive().max(24 * 30),
  active: z.boolean().default(true),
});

const updateSourceSchema = createSourceSchema.partial();

enrichmentRoute.get('/sources', async (c) => {
  const { orgId } = getAuthContext(c);
  try {
    const rows = await listWhere<ScrapeTargetRow>(
      'scrape_targets',
      `(org_id,eq,${Number(orgId)})`,
      500,
    );
    return c.json({ sources: rows.map(normaliseSource) });
  } catch (err) {
    console.error('[enrichment] list sources failed', err);
    return c.json({ error: 'nocodb_error' }, 502);
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
    const row = await createRow<ScrapeTargetRow>('scrape_targets', {
      ...parsed.data,
      org_id: Number(orgId),
      chunk_count: 0,
    });
    return c.json(normaliseSource(row), 201);
  } catch (err) {
    console.error('[enrichment] create source failed', err);
    return c.json({ error: 'nocodb_error' }, 502);
  }
});

/**
 * Look up a scrape_targets row by id, scoped to the caller's org. Returns
 * `null` for both "invalid id" and "not found" — callers should validate the
 * id param themselves before calling so they can map each case to the right
 * HTTP status.
 */
async function loadOwnedSource(
  orgId: number,
  id: number,
): Promise<ScrapeTargetRow | null> {
  const rows = await listWhere<ScrapeTargetRow>(
    'scrape_targets',
    `(Id,eq,${id})~and(org_id,eq,${orgId})`,
    1,
  );
  return rows[0] ?? null;
}

function parseIdParam(raw: string | undefined): number | null {
  if (raw == null) return null;
  try {
    return assertInteger(raw, 'source_id');
  } catch {
    return null;
  }
}

enrichmentRoute.patch('/sources/:id', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = updateSourceSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid_body', issues: parsed.error.issues }, 400);
  }
  const { orgId } = getAuthContext(c);
  try {
    const id = parseIdParam(c.req.param('id'));
    if (id == null) return c.json({ error: 'invalid_id' }, 400);
    const existing = await loadOwnedSource(orgId, id);
    if (!existing) return c.json({ error: 'not_found' }, 404);
    const updated = await patchRow<ScrapeTargetRow>(
      'scrape_targets',
      existing.Id,
      parsed.data,
    );
    return c.json(normaliseSource(updated));
  } catch (err) {
    console.error('[enrichment] patch source failed', err);
    return c.json({ error: 'nocodb_error' }, 502);
  }
});

enrichmentRoute.delete('/sources/:id', async (c) => {
  const { orgId } = getAuthContext(c);
  try {
    const id = parseIdParam(c.req.param('id'));
    if (id == null) return c.json({ error: 'invalid_id' }, 400);
    const existing = await loadOwnedSource(orgId, id);
    if (!existing) return c.json({ error: 'not_found' }, 404);
    await patchRow('scrape_targets', existing.Id, { active: false });
    return c.json({ ok: true });
  } catch (err) {
    console.error('[enrichment] delete source failed', err);
    return c.json({ error: 'nocodb_error' }, 502);
  }
});

enrichmentRoute.post('/sources/:id/trigger', async (c) => {
  // v1: there's no per-source trigger in the harness — fire a full cycle.
  // We still verify ownership so a caller can't trigger from another org.
  const { orgId } = getAuthContext(c);
  try {
    const id = parseIdParam(c.req.param('id'));
    if (id == null) return c.json({ error: 'invalid_id' }, 400);
    const existing = await loadOwnedSource(orgId, id);
    if (!existing) return c.json({ error: 'not_found' }, 404);
    const res = await triggerScheduler();
    return forward(res);
  } catch (err) {
    return mapHarnessError(err);
  }
});

enrichmentRoute.post('/sources/:id/flush', async (c) => {
  // "Flush" v1: reset `content_hash` and `chunk_count` on the Nocodb row. The
  // next enrichment cycle will see a missing hash and force a full re-scrape.
  // The old Chroma chunks linger until the harness grows a proper per-url
  // delete endpoint — we cannot reach Chroma directly from the gateway because
  // collections are org-scoped (`org_{id}_scraped_*`) and chromadb 1.5.5 uses
  // the v2 tenant/database HTTP API, which is fiddly to construct without the
  // Python client's defaults.
  const { orgId } = getAuthContext(c);
  try {
    const id = parseIdParam(c.req.param('id'));
    if (id == null) return c.json({ error: 'invalid_id' }, 400);
    const existing = await loadOwnedSource(orgId, id);
    if (!existing) return c.json({ error: 'not_found' }, 404);
    await patchRow('scrape_targets', existing.Id, {
      chunk_count: 0,
      content_hash: null,
    });
    return c.json({ ok: true, note: 'hash_reset_only' });
  } catch (err) {
    console.error('[enrichment] flush source failed', err);
    return c.json({ error: 'nocodb_error' }, 502);
  }
});

// --- Log --------------------------------------------------------------------

const logQuerySchema = z.object({
  cycle_id: z.string().optional(),
  event_type: z.string().optional(), // comma-separated enum values
  scrape_target_id: z.coerce.number().int().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(500).default(50),
});

enrichmentRoute.get('/log', async (c) => {
  const parsed = logQuerySchema.safeParse(
    Object.fromEntries(new URL(c.req.url).searchParams),
  );
  if (!parsed.success) {
    return c.json({ error: 'invalid_query', issues: parsed.error.issues }, 400);
  }
  const { orgId } = getAuthContext(c);
  const { cycle_id, event_type, scrape_target_id, page, limit } = parsed.data;

  const clauses: string[] = [`(org_id,eq,${Number(orgId)})`];
  if (cycle_id) clauses.push(`(cycle_id,eq,${escapeNocoFilter(cycle_id)})`);
  if (scrape_target_id != null)
    clauses.push(`(scrape_target_id,eq,${scrape_target_id})`);
  if (event_type) {
    const values = event_type
      .split(',')
      .map((v) => v.trim())
      .filter((v): v is (typeof EVENT_TYPES)[number] =>
        (EVENT_TYPES as readonly string[]).includes(v),
      );
    if (values.length > 0) {
      // Nocodb supports `in` with comma-separated values.
      clauses.push(`(event_type,in,${values.join(',')})`);
    }
  }

  try {
    const result = await listPage<EnrichmentLogRow>('enrichment_log', {
      where: clauses.join('~and'),
      limit,
      offset: (page - 1) * limit,
      sort: '-CreatedAt',
    });
    return c.json({
      entries: result.list.map(normaliseLogEntry),
      page,
      limit,
      total: result.pageInfo?.totalRows ?? result.list.length,
    });
  } catch (err) {
    console.error('[enrichment] list log failed', err);
    return c.json({ error: 'nocodb_error' }, 502);
  }
});

// --- Suggestions ------------------------------------------------------------

const reviewSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  frequency_hours: z.number().int().positive().max(24 * 30).optional(),
});

enrichmentRoute.get('/suggestions', async (c) => {
  const { orgId } = getAuthContext(c);
  try {
    const result = await listPage<SuggestionRow>('suggested_scrape_targets', {
      where: `(org_id,eq,${Number(orgId)})~and(status,eq,pending)`,
      limit: 200,
      sort: '-times_suggested,-confidence_score',
    });
    return c.json({ suggestions: result.list.map(normaliseSuggestion) });
  } catch (err) {
    console.error('[enrichment] list suggestions failed', err);
    return c.json({ error: 'nocodb_error' }, 502);
  }
});

enrichmentRoute.patch('/suggestions/:id', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid_body', issues: parsed.error.issues }, 400);
  }
  const { orgId } = getAuthContext(c);
  let suggestionId: number;
  try {
    suggestionId = assertInteger(c.req.param('id'), 'suggestion_id');
  } catch {
    return c.json({ error: 'invalid_id' }, 400);
  }

  try {
    const rows = await listWhere<SuggestionRow>(
      'suggested_scrape_targets',
      `(Id,eq,${suggestionId})~and(org_id,eq,${Number(orgId)})`,
      1,
    );
    const suggestion = rows[0];
    if (!suggestion) return c.json({ error: 'not_found' }, 404);

    if (parsed.data.status === 'approved') {
      await createRow('scrape_targets', {
        org_id: Number(orgId),
        name: suggestion.name,
        url: suggestion.url,
        category: suggestion.category,
        frequency_hours: parsed.data.frequency_hours ?? 24,
        active: true,
        chunk_count: 0,
      });
    }
    await patchRow('suggested_scrape_targets', suggestion.Id, {
      status: parsed.data.status,
      reviewed_at: new Date().toISOString(),
    });
    return c.json({ ok: true });
  } catch (err) {
    console.error('[enrichment] review suggestion failed', err);
    return c.json({ error: 'nocodb_error' }, 502);
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
  // Harness does not (yet) expose /graph/coverage — we return an empty list so
  // the frontend tab renders its empty state cleanly instead of surfacing a
  // 502. Once the harness ships the endpoint, remove this short-circuit.
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
