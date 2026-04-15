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
  try {
    const res = await harnessClient.post('/enrichment/pathfinder/start', {}, TIMEOUT);
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'enrichment');
  }
});

enrichmentRoute.get('/discovery/list', async (c) => {
  const { orgId } = getAuthContext(c);
  const status = c.req.query('status');
  const limit = c.req.query('limit');
  let qs = `org_id=${orgId}`;
  if (status) qs += `&status=${status}`;
  if (limit) qs += `&limit=${limit}`;
  try {
    const res = await harnessClient.get(`/enrichment/discovery/list?${qs}`, TIMEOUT);
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'enrichment');
  }
});

enrichmentRoute.get('/scrape-targets/list', async (c) => {
  const { orgId } = getAuthContext(c);
  const status = c.req.query('status');
  const activeOnly = c.req.query('active_only');
  const limit = c.req.query('limit');
  let qs = `org_id=${orgId}`;
  if (status) qs += `&status=${status}`;
  if (activeOnly) qs += `&active_only=${activeOnly}`;
  if (limit) qs += `&limit=${limit}`;
  try {
    const res = await harnessClient.get(`/enrichment/scrape-targets/list?${qs}`, TIMEOUT);
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
  try {
    const res = await harnessClient.post('/enrichment/scraper/start', {}, TIMEOUT);
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
  const status = c.req.query('status');
  const limit = c.req.query('limit');
  let qs = `org_id=${orgId}`;
  if (status) qs += `&status=${status}`;
  if (limit) qs += `&limit=${limit}`;
  try {
    const res = await harnessClient.get(`/enrichment/research-plans/list?${qs}`, TIMEOUT);
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'enrichment');
  }
});

enrichmentRoute.get('/research-plans/:id', async (c) => {
  const id = c.req.param('id');
  const { orgId } = getAuthContext(c);
  try {
    const res = await harnessClient.get(
      `/enrichment/research-plans/${encodeURIComponent(id)}?org_id=${orgId}`,
      TIMEOUT,
    );
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'enrichment');
  }
});