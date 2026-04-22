import { Hono } from 'hono';
import { FetchTimeoutError } from '../lib/FetchTimeoutError.js';
import { listStyles } from '../services/harness/index.js';


export const stylesRoute = new Hono();

stylesRoute.get('/', async (c) => {
  const surfaceParam = c.req.query('surface');
  const surface =
    surfaceParam === 'chat' || surfaceParam === 'code' ? surfaceParam : undefined;

  try {
    const res = await listStyles(surface);
    if (!res.ok) {
      const text = await res.text();
      return c.json(
        { error: 'harness_error', status: res.status, detail: text.slice(0, 300) },
        502,
      );
    }
    const body = (await res.json()) as unknown;
    return c.json(body as Record<string, unknown>, 200, {
      'Cache-Control': 'no-store',
    });
  } catch (err) {
    if (err instanceof FetchTimeoutError) {
      return c.json({ error: 'harness_timeout' }, 504);
    }
    console.error('[styles] harness unreachable', err);
    return c.json({ error: 'harness_unreachable' }, 502);
  }
});
