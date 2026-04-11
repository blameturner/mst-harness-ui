import { Hono } from 'hono';
import { requireAuth } from '../middleware/requireAuth.js';
import { env } from '../env.js';
import type { AuthVariables } from '../types/AuthVariables.js';

export const streamRoute = new Hono<{ Variables: AuthVariables }>();

streamRoute.use('*', requireAuth);

streamRoute.get('/:jobId', async (c) => {
  const jobId = c.req.param('jobId');
  const cursor = c.req.query('cursor') ?? '0';

  const url = `${env.HARNESS_URL}/stream/${encodeURIComponent(jobId)}?cursor=${encodeURIComponent(cursor)}`;

  try {
    const res = await fetch(url, { method: 'GET' });

    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => '');
      return c.json(
        { error: 'harness_error', status: res.status, detail: text.slice(0, 500) },
        502,
      );
    }

    // Pipe the SSE stream through without buffering.
    // The harness sends keepalives every 15s; our 30s bodyTimeout covers any gap.
    return new Response(res.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (err) {
    console.error('[stream] harness unreachable', err);
    return c.json({ error: 'harness_unreachable' }, 502);
  }
});
