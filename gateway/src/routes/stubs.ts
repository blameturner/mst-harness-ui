// Safe-empty stubs for UI features whose backend endpoints don't exist yet.
//
// The UI calls these unconditionally (graph search box, memory health badge,
// PA feed, etc.) and treats `.catch(() => empty)` as failure → it logs a
// console error and renders nothing. Returning a well-shaped empty payload
// here means the UI renders cleanly while the real backend is being built.
//
// When a real harness route lands, replace the stub here with a proxy in a
// dedicated route file.

import { Hono } from 'hono';
import { requireAuth } from '../middleware/requireAuth.js';
import type { AuthVariables } from '../types/AuthVariables.js';

function emptyRoute<T extends Record<string, unknown>>(
  shape: T,
): Hono<{ Variables: AuthVariables }> {
  const r = new Hono<{ Variables: AuthVariables }>();
  r.use('*', requireAuth);
  r.all('/*', (c) => c.json(shape, 200));
  return r;
}

// graph + memory stubs replaced by real proxies — see routes/graph.ts and
// routes/memory.ts.

// /api/pa/* — anchored asks, feed, topics. PA backend is reached via
// /api/home/pa/{status,run}; these standalone endpoints aren't wired yet.
export const paStubRoute = new Hono<{ Variables: AuthVariables }>();
paStubRoute.use('*', requireAuth);
paStubRoute.get('/anchored-asks', (c) => c.json({ items: [], count: 0 }));
paStubRoute.get('/feed', (c) => c.json({ items: [] }));
paStubRoute.get('/topics', (c) => c.json({ topics: [] }));
paStubRoute.get('/topics/:id', (c) => c.json({ topic: null }));
paStubRoute.post('/anchored-asks/:id/close', (c) => c.json({ ok: true }));
paStubRoute.post('/anchored-asks/:id/nudge', (c) => c.json({ ok: true }));
paStubRoute.post('/anchored-asks/:id/snooze', (c) => c.json({ ok: true }));
paStubRoute.post('/topics/:id/mute', (c) => c.json({ ok: true }));
paStubRoute.post('/topics/:id/research-now', (c) => c.json({ ok: true, queued: false }));

// /api/research/artifacts — top-level research artifact browser. Real research
// runs through /api/enrichment/research/* (already proxied).
export const researchStubRoute = emptyRoute({ artifacts: [] });

// /api/triggers/:id/{next,fire-now} — UI calls these on the schedules tab.
// Real cron triggers are managed via /api/admin/trigger/:id (now proxied
// through admin.ts). Until /next and /fire-now have backend support, return
// safe defaults.
export const triggersStubRoute = new Hono<{ Variables: AuthVariables }>();
triggersStubRoute.use('*', requireAuth);
triggersStubRoute.get('/:id/next', (c) => c.json({ id: c.req.param('id'), next: null }));
triggersStubRoute.post('/:id/fire-now', (c) =>
  c.json({ id: c.req.param('id'), fired: false, reason: 'not_implemented' }),
);
