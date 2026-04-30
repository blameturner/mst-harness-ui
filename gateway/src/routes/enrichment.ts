import { Hono } from 'hono';
import { z } from 'zod';
import { requireAuth } from '../middleware/requireAuth.js';
import { getAuthContext } from '../lib/auth-context.js';
import { mapHarnessError } from '../lib/mapHarnessError.js';
import { forwardResponse } from '../lib/forwardResponse.js';
import type { AuthVariables } from '../types/AuthVariables.js';
import { harnessClient } from '../services/harness/client.js';

const TIMEOUT = 30_000;

export const enrichmentRoute = new Hono<{ Variables: AuthVariables }>();

enrichmentRoute.use('*', requireAuth);

// ── Frontend-shaped suggestion endpoints ──────────────────────────────────
// The Enrichment UI calls /suggestions/pending, /preview/:id, /:id/decision.
// These wrap the harness's /enrichment/suggestions/* (which themselves are
// thin wrappers around /enrichment/discovery/suggestions/*).

enrichmentRoute.get('/suggestions/pending', async (c) => {
  const { orgId } = getAuthContext(c);
  const qs = scopedSearch(c.req.url, orgId);
  try {
    const res = await harnessClient.get(`/enrichment/suggestions/pending${qs}`, TIMEOUT);
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'enrichment');
  }
});

enrichmentRoute.get('/suggestions/preview/:id', async (c) => {
  const id = c.req.param('id');
  const { orgId } = getAuthContext(c);
  try {
    const res = await harnessClient.get(
      `/enrichment/suggestions/preview/${encodeURIComponent(id)}?org_id=${Number(orgId)}`,
      TIMEOUT,
    );
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'enrichment');
  }
});

enrichmentRoute.post('/suggestions/:id/decision', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => null);
  const schema = z.object({
    decision: z.enum(['approve', 'reject', 'defer']),
    reason: z.string().optional(),
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid_body', details: parsed.error.errors }, 400);
  }
  const { orgId } = getAuthContext(c);
  try {
    const res = await harnessClient.post(
      `/enrichment/suggestions/${encodeURIComponent(id)}/decision?org_id=${Number(orgId)}`,
      parsed.data,
      TIMEOUT,
    );
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'enrichment');
  }
});

function scopedSearch(url: string, orgId: number | string): string {
  const parsedUrl = new URL(url);
  parsedUrl.searchParams.set('org_id', String(orgId));
  const qs = parsedUrl.searchParams.toString();
  return qs ? `?${qs}` : '';
}

// ========== Pathfinder (URL Discovery) ==========

enrichmentRoute.post('/pathfinder/discover', async (c) => {
  const body = await c.req.json().catch(() => null);
  const schema = z.object({
    seed_url: z.string().url(),
    max_depth: z.number().int().min(1).max(10).default(3),
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid_body', details: parsed.error.errors }, 400);
  }
  const { orgId } = getAuthContext(c);
  try {
    const res = await harnessClient.post(
      '/enrichment/pathfinder/discover',
      { ...parsed.data, org_id: Number(orgId) },
      TIMEOUT
    );
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'enrichment');
  }
});

enrichmentRoute.post('/pathfinder/fetch-next', async (c) => {
  try {
    const res = await harnessClient.post('/enrichment/pathfinder/fetch-next', {}, TIMEOUT);
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'enrichment');
  }
});

enrichmentRoute.post('/pathfinder/mark-processed', async (c) => {
  const body = await c.req.json().catch(() => null);
  const schema = z.object({ url_id: z.number().int() });
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid_body', details: parsed.error.errors }, 400);
  }
  try {
    const res = await harnessClient.post(
      `/enrichment/pathfinder/mark-processed?url_id=${parsed.data.url_id}`,
      {},
      TIMEOUT,
    );
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'enrichment');
  }
});

enrichmentRoute.post('/pathfinder/start', async (c) => {
  const { orgId } = getAuthContext(c);
  const qs = scopedSearch(c.req.url, orgId);
  try {
    const res = await harnessClient.post(`/enrichment/pathfinder/start${qs}`, {}, TIMEOUT);
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'enrichment');
  }
});

enrichmentRoute.post('/discover-agent/start', async (c) => {
  const { orgId } = getAuthContext(c);
  const qs = scopedSearch(c.req.url, orgId);
  try {
    const res = await harnessClient.post(`/enrichment/discover-agent/start${qs}`, {}, TIMEOUT);
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'enrichment');
  }
});

// Static routes MUST be registered before dynamic /:id routes —
// Hono resolves the first match, so /list would be captured as id="list" otherwise.

enrichmentRoute.get('/discovery/list', async (c) => {
  const { orgId } = getAuthContext(c);
  const qs = scopedSearch(c.req.url, orgId);
  try {
    const res = await harnessClient.get(`/enrichment/discovery/list${qs}`, TIMEOUT);
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'enrichment');
  }
});

enrichmentRoute.get('/scrape-targets/list', async (c) => {
  const { orgId } = getAuthContext(c);
  const qs = scopedSearch(c.req.url, orgId);
  try {
    const res = await harnessClient.get(`/enrichment/scrape-targets/list${qs}`, TIMEOUT);
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'enrichment');
  }
});

enrichmentRoute.get('/discovery/suggestions', async (c) => {
  const { orgId } = getAuthContext(c);
  const qs = scopedSearch(c.req.url, orgId);
  try {
    const res = await harnessClient.get(`/enrichment/discovery/suggestions${qs}`, TIMEOUT);
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'enrichment');
  }
});

enrichmentRoute.post('/discovery/suggestions/:id/approve', async (c) => {
  const id = c.req.param('id');
  const { orgId } = getAuthContext(c);
  const qs = scopedSearch(c.req.url, orgId);
  try {
    const res = await harnessClient.post(
      `/enrichment/discovery/suggestions/${encodeURIComponent(id)}/approve${qs}`,
      {},
      TIMEOUT,
    );
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'enrichment');
  }
});

enrichmentRoute.post('/discovery/suggestions/:id/reject', async (c) => {
  const id = c.req.param('id');
  const { orgId } = getAuthContext(c);
  const qs = scopedSearch(c.req.url, orgId);
  try {
    const res = await harnessClient.post(
      `/enrichment/discovery/suggestions/${encodeURIComponent(id)}/reject${qs}`,
      {},
      TIMEOUT,
    );
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'enrichment');
  }
});

// Dynamic detail routes — registered AFTER static /list routes.

enrichmentRoute.get('/discovery/:id', async (c) => {
  const id = c.req.param('id');
  const { orgId } = getAuthContext(c);
  try {
    const res = await harnessClient.get(
      `/enrichment/discovery/${encodeURIComponent(id)}?org_id=${Number(orgId)}`,
      TIMEOUT,
    );
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'enrichment');
  }
});

enrichmentRoute.get('/scrape-targets/:id', async (c) => {
  const id = c.req.param('id');
  const { orgId } = getAuthContext(c);
  try {
    const res = await harnessClient.get(
      `/enrichment/scrape-targets/${encodeURIComponent(id)}?org_id=${Number(orgId)}`,
      TIMEOUT,
    );
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'enrichment');
  }
});

enrichmentRoute.post('/scrape-targets/:id/run-now', async (c) => {
  const id = c.req.param('id');
  const { orgId } = getAuthContext(c);
  try {
    const res = await harnessClient.post(
      `/enrichment/scrape-targets/${encodeURIComponent(id)}/run-now?org_id=${Number(orgId)}`,
      {},
      TIMEOUT,
    );
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'enrichment');
  }
});

enrichmentRoute.get('/dashboard', async (c) => {
  const { orgId } = getAuthContext(c);
  const qs = scopedSearch(c.req.url, orgId);
  try {
    const res = await harnessClient.get(`/enrichment/dashboard${qs}`, TIMEOUT);
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'enrichment');
  }
});

enrichmentRoute.get('/sources/health', async (c) => {
  const { orgId } = getAuthContext(c);
  const qs = scopedSearch(c.req.url, orgId);
  try {
    const res = await harnessClient.get(`/enrichment/sources/health${qs}`, TIMEOUT);
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'enrichment');
  }
});

enrichmentRoute.post('/scrape-targets/bump', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { orgId } = getAuthContext(c);
  try {
    const res = await harnessClient.post(
      '/enrichment/scrape-targets/bump',
      { ...(body as object), org_id: Number((body as { org_id?: number })?.org_id ?? orgId) },
      TIMEOUT,
    );
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'enrichment');
  }
});

// ========== Scraper (Content Extraction) ==========

enrichmentRoute.post('/scraper/run', async (c) => {
  const body = await c.req.json().catch(() => null);
  const schema = z.object({
    batch_size: z.number().int().min(1).max(100).default(10),
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid_body', details: parsed.error.errors }, 400);
  }
  const { orgId } = getAuthContext(c);
  try {
    const res = await harnessClient.post(
      '/enrichment/scraper/run',
      { ...parsed.data, org_id: Number(orgId) },
      TIMEOUT
    );
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'enrichment');
  }
});

enrichmentRoute.post('/scraper/scrape-next', async (c) => {
  try {
    const res = await harnessClient.post('/enrichment/scraper/scrape-next', {}, TIMEOUT);
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'enrichment');
  }
});

enrichmentRoute.post('/scraper/start', async (c) => {
  const { orgId } = getAuthContext(c);
  const qs = scopedSearch(c.req.url, orgId);
  try {
    const res = await harnessClient.post(`/enrichment/scraper/start${qs}`, {}, TIMEOUT);
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'enrichment');
  }
});

// ========== Research Planner (AI Research Agent) ==========

enrichmentRoute.post('/research/create-plan', async (c) => {
  const body = await c.req.json().catch(() => null);
  const schema = z.object({
    topic: z.string().min(1).max(500),
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid_body', details: parsed.error.errors }, 400);
  }
  const { orgId } = getAuthContext(c);
  try {
    const res = await harnessClient.post(
      '/enrichment/research/create-plan',
      { ...parsed.data, org_id: Number(orgId) },
      TIMEOUT
    );
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'enrichment');
  }
});

enrichmentRoute.post('/research/get-next', async (c) => {
  try {
    const res = await harnessClient.post('/enrichment/research/get-next', {}, TIMEOUT);
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'enrichment');
  }
});

enrichmentRoute.post('/research/complete', async (c) => {
  const body = await c.req.json().catch(() => null);
  const schema = z.object({ plan_id: z.number().int() });
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid_body', details: parsed.error.errors }, 400);
  }
  try {
    const res = await harnessClient.post(
      `/enrichment/research/complete?plan_id=${parsed.data.plan_id}`,
      {},
      TIMEOUT,
    );
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'enrichment');
  }
});

enrichmentRoute.post('/research/agent/run', async (c) => {
  const body = await c.req.json().catch(() => null);
  const schema = z.object({ plan_id: z.number().int() });
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid_body', details: parsed.error.errors }, 400);
  }
  try {
    const res = await harnessClient.post('/enrichment/research/agent/run', parsed.data, TIMEOUT);
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'enrichment');
  }
});

enrichmentRoute.post('/research/agent/next', async (_c) => {
  try {
    const res = await harnessClient.post('/enrichment/research/agent/next', {}, TIMEOUT);
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'enrichment');
  }
});

enrichmentRoute.get('/research-plans/list', async (c) => {
  const { orgId } = getAuthContext(c);
  const qs = scopedSearch(c.req.url, orgId);
  try {
    const res = await harnessClient.get(`/enrichment/research-plans/list${qs}`, TIMEOUT);
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'enrichment');
  }
});

enrichmentRoute.get('/research-plans/:id', async (c) => {
  const id = c.req.param('id');
  const { orgId } = getAuthContext(c);
  const qs = scopedSearch(c.req.url, orgId);
  try {
    const res = await harnessClient.get(
      `/enrichment/research-plans/${encodeURIComponent(id)}${qs}`,
      TIMEOUT,
    );
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'enrichment');
  }
});

enrichmentRoute.get('/research/doc-types', async (_c) => {
  try {
    const res = await harnessClient.get('/enrichment/research/doc-types', TIMEOUT);
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'enrichment');
  }
});

enrichmentRoute.post('/research/:id/start', async (c) => {
  const id = c.req.param('id');
  try {
    const res = await harnessClient.post(
      `/enrichment/research/${encodeURIComponent(id)}/start`,
      {},
      TIMEOUT,
    );
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'enrichment');
  }
});

enrichmentRoute.post('/research/:id/review', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const schema = z.object({ instructions: z.string().optional() });
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) {
    return c.json({ error: 'invalid_body', details: parsed.error.errors }, 400);
  }
  try {
    const res = await harnessClient.post(
      `/enrichment/research/${encodeURIComponent(id)}/review`,
      parsed.data,
      TIMEOUT,
    );
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'enrichment');
  }
});

enrichmentRoute.post('/research/:id/ops/:kind', async (c) => {
  const id = c.req.param('id');
  const kind = c.req.param('kind');
  const body = await c.req.json().catch(() => ({}));
  const schema = z.object({ params: z.record(z.unknown()).optional() });
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) {
    return c.json({ error: 'invalid_body', details: parsed.error.errors }, 400);
  }
  try {
    const res = await harnessClient.post(
      `/enrichment/research/${encodeURIComponent(id)}/ops/${encodeURIComponent(kind)}`,
      parsed.data,
      TIMEOUT,
    );
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'enrichment');
  }
});

enrichmentRoute.get('/research/:id/artifacts', async (c) => {
  const id = c.req.param('id');
  try {
    const res = await harnessClient.get(
      `/enrichment/research/${encodeURIComponent(id)}/artifacts`,
      TIMEOUT,
    );
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'enrichment');
  }
});