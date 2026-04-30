// /api/graph/* — proxies to the harness home/graph endpoints.
//
// Transforms harness payloads to the shapes the existing UI expects so the
// graph search page works without churning the api/graph client. New
// surfaces (ask, path, timeline, diff, export, merge) are exposed verbatim.

import { Hono } from 'hono';
import { requireAuth } from '../middleware/requireAuth.js';
import { getAuthContext } from '../lib/auth-context.js';
import { mapHarnessError } from '../lib/mapHarnessError.js';
import { forwardResponse } from '../lib/forwardResponse.js';
import { harnessClient } from '../services/harness/client.js';
import type { AuthVariables } from '../types/AuthVariables.js';

const TIMEOUT = 30_000;
const SYNTH_TIMEOUT = 60_000;

export const graphRoute = new Hono<{ Variables: AuthVariables }>();
graphRoute.use('*', requireAuth);

interface HarnessGraphSearchEntity {
  name: string;
  type?: string | null;
  edges_in?: number;
  edges_out?: number;
}
interface HarnessGraphEdge {
  from: string;
  from_type?: string | null;
  to: string;
  to_type?: string | null;
  relationship: string;
  hits: number;
  weight: number;
  last_seen?: string | null;
  source_chunks?: string[];
  confidence?: number;
}
interface HarnessGraphSearchResponse {
  query?: string;
  matched_entities?: string[];
  entities?: HarnessGraphSearchEntity[];
  edges?: HarnessGraphEdge[];
  answer?: string;
}

// GET /api/graph/search?q&limit — returns {hits: [{id,label,type,degree}]}
graphRoute.get('/search', async (c) => {
  const { orgId } = getAuthContext(c);
  const url = new URL(c.req.url);
  const q = (url.searchParams.get('q') ?? '').trim();
  const limit = Number(url.searchParams.get('limit') ?? 25);
  if (!q) return c.json({ hits: [] });
  try {
    const res = await harnessClient.post(
      '/home/graph/search',
      { org_id: orgId, query: q, max_hops: 1, edge_limit: Math.min(Math.max(limit * 2, 25), 200) },
      TIMEOUT,
    );
    if (!res.ok) return forwardResponse(res);
    const data = (await res.json()) as HarnessGraphSearchResponse;
    const entities = data.entities ?? [];
    const hits = entities
      .map((e) => ({
        id: e.name,
        label: e.name,
        type: (e.type ?? 'entity').toLowerCase(),
        degree: (e.edges_in ?? 0) + (e.edges_out ?? 0),
      }))
      .sort((a, b) => b.degree - a.degree)
      .slice(0, limit);
    return c.json({ hits, matched: data.matched_entities ?? [] });
  } catch (err) {
    return mapHarnessError(err, 'graph');
  }
});

// POST /api/graph/ask — passthrough to /home/graph/ask
graphRoute.post('/ask', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    query?: string;
    max_hops?: number;
    edge_limit?: number;
    max_tokens?: number;
  };
  const { orgId } = getAuthContext(c);
  try {
    const res = await harnessClient.post(
      '/home/graph/ask',
      { org_id: orgId, query: (body.query ?? '').trim(), ...body },
      SYNTH_TIMEOUT,
    );
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'graph');
  }
});

// GET /api/graph/neighbourhood/:id — return {nodes, edges, center}
graphRoute.get('/neighbourhood/:id', async (c) => {
  const { orgId } = getAuthContext(c);
  const id = c.req.param('id');
  const url = new URL(c.req.url);
  const hops = Number(url.searchParams.get('hops') ?? 2);
  try {
    const res = await harnessClient.get(
      `/home/graph/entity?org_id=${encodeURIComponent(String(orgId))}` +
        `&name=${encodeURIComponent(id)}&max_hops=${hops}&edge_limit=200`,
      TIMEOUT,
    );
    if (!res.ok) return forwardResponse(res);
    const data = (await res.json()) as {
      entity?: { name: string; type?: string | null; aliases?: string[]; degree?: number };
      edges?: HarnessGraphEdge[];
    };
    const edges = (data.edges ?? []).map((e) => ({
      src: e.from,
      dst: e.to,
      type: e.relationship,
      weight: e.weight ?? 1,
    }));
    const nodeIds = new Set<string>();
    const nodes: Array<{ id: string; label: string; type: string; aliases?: string[]; degree?: number }> = [];
    if (data.entity?.name) {
      nodes.push({
        id: data.entity.name,
        label: data.entity.name,
        type: (data.entity.type ?? 'entity').toLowerCase(),
        aliases: data.entity.aliases,
        degree: data.entity.degree,
      });
      nodeIds.add(data.entity.name);
    }
    for (const e of data.edges ?? []) {
      for (const [name, type] of [
        [e.from, e.from_type],
        [e.to, e.to_type],
      ] as const) {
        if (!name || nodeIds.has(name)) continue;
        nodes.push({ id: name, label: name, type: ((type as string) ?? 'entity').toLowerCase() });
        nodeIds.add(name);
      }
    }
    return c.json({ nodes, edges, center: id });
  } catch (err) {
    return mapHarnessError(err, 'graph');
  }
});

// GET /api/graph/node/:id
graphRoute.get('/node/:id', async (c) => {
  const { orgId } = getAuthContext(c);
  const id = c.req.param('id');
  try {
    const res = await harnessClient.get(
      `/home/graph/entity?org_id=${encodeURIComponent(String(orgId))}&name=${encodeURIComponent(id)}&max_hops=1&edge_limit=1`,
      TIMEOUT,
    );
    if (!res.ok) return forwardResponse(res);
    const data = (await res.json()) as {
      entity?: { name: string; type?: string | null; aliases?: string[]; degree?: number };
    };
    if (!data.entity?.name) return c.json({ node: null });
    return c.json({
      id: data.entity.name,
      label: data.entity.name,
      type: (data.entity.type ?? 'entity').toLowerCase(),
      aliases: data.entity.aliases,
      degree: data.entity.degree,
    });
  } catch (err) {
    return mapHarnessError(err, 'graph');
  }
});

// GET /api/graph/path?src&dst — adapt harness POST endpoint
graphRoute.get('/path', async (c) => {
  const { orgId } = getAuthContext(c);
  const url = new URL(c.req.url);
  const src = (url.searchParams.get('src') ?? '').trim();
  const dst = (url.searchParams.get('dst') ?? '').trim();
  if (!src || !dst) return c.json({ nodes: [], edges: [] });
  try {
    const res = await harnessClient.post(
      '/home/graph/path',
      { org_id: orgId, from_name: src, to_name: dst, max_hops: 4 },
      TIMEOUT,
    );
    if (!res.ok) return forwardResponse(res);
    const data = (await res.json()) as {
      from?: string;
      to?: string;
      path?: Array<{ name: string; type?: string | null }>;
      edges?: Array<{ from: string; to: string; relationship: string; weight: number; confidence?: number }>;
      hops?: number;
    };
    return c.json({
      nodes: (data.path ?? []).map((n) => ({
        id: n.name,
        label: n.name,
        type: ((n.type ?? 'entity') as string).toLowerCase(),
      })),
      edges: (data.edges ?? []).map((e) => ({
        src: e.from,
        dst: e.to,
        type: e.relationship,
        weight: e.weight,
      })),
    });
  } catch (err) {
    return mapHarnessError(err, 'graph');
  }
});

// GET /api/graph/entity/:name/timeline
graphRoute.get('/entity/:name/timeline', async (c) => {
  const { orgId } = getAuthContext(c);
  const name = c.req.param('name');
  try {
    const res = await harnessClient.get(
      `/home/graph/entity/${encodeURIComponent(name)}/timeline?org_id=${encodeURIComponent(String(orgId))}`,
      TIMEOUT,
    );
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'graph');
  }
});

// GET /api/graph/diff
graphRoute.get('/diff', async (c) => {
  const { orgId } = getAuthContext(c);
  const url = new URL(c.req.url);
  const days = Number(url.searchParams.get('since_days') ?? 7);
  try {
    const res = await harnessClient.get(
      `/home/graph/diff?org_id=${encodeURIComponent(String(orgId))}&since_days=${days}`,
      TIMEOUT,
    );
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'graph');
  }
});

// GET /api/graph/export
graphRoute.get('/export', async (c) => {
  const { orgId } = getAuthContext(c);
  const url = new URL(c.req.url);
  const seed = url.searchParams.get('seed') ?? '';
  const hops = Number(url.searchParams.get('hops') ?? 2);
  const format = url.searchParams.get('format') ?? 'cytoscape';
  try {
    const res = await harnessClient.get(
      `/home/graph/export?org_id=${encodeURIComponent(String(orgId))}` +
        `&seed=${encodeURIComponent(seed)}&hops=${hops}&format=${encodeURIComponent(format)}`,
      TIMEOUT,
    );
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'graph');
  }
});

// POST /api/graph/entity/merge
graphRoute.post('/entity/merge', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    label?: string;
    canonical?: string;
    alias?: string;
  };
  const { orgId } = getAuthContext(c);
  try {
    const res = await harnessClient.post(
      '/home/graph/entity/merge',
      { org_id: orgId, ...body },
      TIMEOUT,
    );
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'graph');
  }
});

// GET /api/graph/stats — adapt /stats/graph/snapshot
graphRoute.get('/stats', async (c) => {
  const { orgId } = getAuthContext(c);
  try {
    const res = await harnessClient.get(
      `/graph/snapshot?org_id=${encodeURIComponent(String(orgId))}&limit=20`,
      TIMEOUT,
    );
    if (!res.ok) return forwardResponse(res);
    const data = (await res.json()) as {
      summary?: { total_nodes?: number; total_edges?: number; node_types?: Record<string, number> };
    };
    return c.json({
      nodes_total: data.summary?.total_nodes ?? 0,
      edges_total: data.summary?.total_edges ?? 0,
      by_type: Object.entries(data.summary?.node_types ?? {}).map(([type, count]) => ({ type, count })),
      by_edge_type: [] as Array<{ type: string; count: number }>,
    });
  } catch (err) {
    return mapHarnessError(err, 'graph');
  }
});

// GET /api/graph/maintenance/events — placeholder until backend wires events
graphRoute.get('/maintenance/events', (c) => c.json({ events: [] }));

// Resolution helpers — UI calls these on the resolution tab
graphRoute.get('/resolution/candidates', (c) => c.json({ pairs: [] }));
graphRoute.post('/resolution/decide', (c) => c.json({ ok: true }));

// Edge evidence — derive from neighbourhood; chunks are not yet exposed by the harness
graphRoute.get('/edge/:src/:dst/evidence', async (c) => {
  const { orgId } = getAuthContext(c);
  const src = c.req.param('src');
  const dst = c.req.param('dst');
  try {
    const res = await harnessClient.get(
      `/home/graph/entity?org_id=${encodeURIComponent(String(orgId))}&name=${encodeURIComponent(src)}&max_hops=1&edge_limit=200`,
      TIMEOUT,
    );
    if (!res.ok) return forwardResponse(res);
    const data = (await res.json()) as { edges?: HarnessGraphEdge[] };
    const edge = (data.edges ?? []).find((e) => e.from === src && e.to === dst);
    if (!edge) return c.json({ edge: null, chunks: [] });
    return c.json({
      edge: { src: edge.from, dst: edge.to, type: edge.relationship, weight: edge.weight },
      chunks: (edge.source_chunks ?? []).map((id) => ({ id, text: '' })),
    });
  } catch (err) {
    return mapHarnessError(err, 'graph');
  }
});
