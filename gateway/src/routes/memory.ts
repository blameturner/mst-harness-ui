// /api/memory/* — proxies to the harness home/memory endpoints.
//
// Transforms harness payloads to the shape the existing frontend expects so
// the UI works without churning the api/memory client. New surfaces (ask,
// forget) are exposed verbatim.

import { Hono } from 'hono';
import { requireAuth } from '../middleware/requireAuth.js';
import { getAuthContext } from '../lib/auth-context.js';
import { mapHarnessError } from '../lib/mapHarnessError.js';
import { forwardResponse } from '../lib/forwardResponse.js';
import { harnessClient } from '../services/harness/client.js';
import type { AuthVariables } from '../types/AuthVariables.js';

const TIMEOUT = 30_000;

export const memoryRoute = new Hono<{ Variables: AuthVariables }>();
memoryRoute.use('*', requireAuth);

// GET /api/memory/collections — list of {name, chunk_count}
memoryRoute.get('/collections', async (c) => {
  const { orgId } = getAuthContext(c);
  try {
    const res = await harnessClient.get(
      `/home/memory/collections?org_id=${encodeURIComponent(String(orgId))}`,
      TIMEOUT,
    );
    if (!res.ok) return forwardResponse(res);
    const data = (await res.json()) as {
      collections?: Array<{ name: string; records?: number | null }>;
    };
    return c.json({
      collections: (data.collections ?? []).map((row) => ({
        name: row.name,
        chunk_count: Number(row.records ?? 0),
      })),
    });
  } catch (err) {
    return mapHarnessError(err, 'memory');
  }
});

// GET /api/memory/collections/:name/stats — minimal stats (no per-collection
// freshness on the harness yet; surface chunk_count + an empty sparkline)
memoryRoute.get('/collections/:name/stats', async (c) => {
  const { orgId } = getAuthContext(c);
  const name = c.req.param('name');
  try {
    const res = await harnessClient.get(
      `/home/memory/collections?org_id=${encodeURIComponent(String(orgId))}`,
      TIMEOUT,
    );
    if (!res.ok) return forwardResponse(res);
    const data = (await res.json()) as {
      collections?: Array<{ name: string; records?: number | null }>;
    };
    const row = (data.collections ?? []).find((r) => r.name === name);
    return c.json({
      name,
      chunk_count: Number(row?.records ?? 0),
      freshness: [] as number[],
    });
  } catch (err) {
    return mapHarnessError(err, 'memory');
  }
});

// GET /api/memory/health — derive from collections + ask endpoint health.
// Harness exposes per-org collection stats; aggregate them into the
// {ok, collections, chunks_total} shape the UI consumes.
memoryRoute.get('/health', async (c) => {
  const { orgId } = getAuthContext(c);
  try {
    const res = await harnessClient.get(
      `/home/memory/collections?org_id=${encodeURIComponent(String(orgId))}`,
      TIMEOUT,
    );
    if (!res.ok) return forwardResponse(res);
    const data = (await res.json()) as {
      collections?: Array<{ name: string; records?: number | null }>;
    };
    const cols = data.collections ?? [];
    const chunksTotal = cols.reduce((acc, r) => acc + Number(r.records ?? 0), 0);
    return c.json({
      ok: true,
      collections: cols.length,
      chunks_total: chunksTotal,
      notes:
        cols.length === 0
          ? ['no collections for this org yet — write something to memory first']
          : undefined,
    });
  } catch (err) {
    return mapHarnessError(err, 'memory');
  }
});

// POST /api/memory/search — raw RAG hits (no synthesis).
// UI expects {hits: [{id, text, distance, collection, ...}]}.
memoryRoute.post('/search', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    q?: string;
    collections?: string[];
    domain?: string;
    max_age_days?: number;
    min_score?: number;
    limit?: number;
  };
  const { orgId } = getAuthContext(c);
  const q = (body.q ?? '').trim();
  if (!q) return c.json({ hits: [] });

  const collections =
    body.collections && body.collections.length > 0
      ? body.collections
      : ['agent_outputs'];

  // Fan out — harness /home/search is single-collection. Issue a small
  // bounded fan-out so the UI gets unified hits across the picked collections.
  try {
    const limit = Math.min(Math.max(body.limit ?? 25, 1), 100);
    const perCol = Math.max(1, Math.ceil(limit / collections.length));
    const all: Array<{
      id: string;
      text: string;
      distance: number;
      collection: string;
      domain?: string;
      url?: string;
      title?: string;
    }> = [];
    for (const coll of collections) {
      const res = await harnessClient.post(
        '/home/search',
        { org_id: orgId, query: q, collection: coll, n_results: perCol },
        TIMEOUT,
      );
      if (!res.ok) continue;
      const payload = (await res.json()) as {
        hits?: Array<{ text: string; metadata?: Record<string, unknown>; distance: number }>;
      };
      for (const h of payload.hits ?? []) {
        const meta = h.metadata ?? {};
        all.push({
          id: String(meta.chunk_id ?? meta.id ?? `${coll}:${all.length}`),
          text: h.text,
          distance: h.distance,
          collection: coll,
          domain: typeof meta.domain === 'string' ? meta.domain : undefined,
          url: typeof meta.url === 'string' ? meta.url : undefined,
          title: typeof meta.title === 'string' ? meta.title : undefined,
        });
      }
    }
    // Optional client-side filters
    let hits = all;
    if (body.min_score != null) {
      const t = Number(body.min_score);
      hits = hits.filter((h) => 1 - h.distance >= t);
    }
    hits.sort((a, b) => a.distance - b.distance);
    return c.json({ hits: hits.slice(0, limit) });
  } catch (err) {
    return mapHarnessError(err, 'memory');
  }
});

// DELETE /api/memory/items/:chunk_id?collection=… — forget a single chunk.
memoryRoute.delete('/items/:chunk_id', async (c) => {
  const { orgId } = getAuthContext(c);
  const chunkId = c.req.param('chunk_id');
  const url = new URL(c.req.url);
  const collection = url.searchParams.get('collection');
  if (!collection) {
    return c.json({ error: 'collection query param is required' }, 400);
  }
  try {
    const harnessUrl =
      `/home/memory/items/${encodeURIComponent(chunkId)}` +
      `?org_id=${encodeURIComponent(String(orgId))}` +
      `&collection=${encodeURIComponent(collection)}`;
    const res = await harnessClient.delete(harnessUrl, TIMEOUT);
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'memory');
  }
});

// POST /api/memory/ask — synthesised answer with cited sources.
memoryRoute.post('/ask', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    query?: string;
    collections?: string[];
    n_results?: number;
    max_tokens?: number;
  };
  const { orgId } = getAuthContext(c);
  try {
    const res = await harnessClient.post(
      '/home/memory/ask',
      {
        org_id: orgId,
        query: (body.query ?? '').trim(),
        collections: body.collections,
        n_results: body.n_results,
        max_tokens: body.max_tokens,
      },
      60_000,
    );
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'memory');
  }
});
