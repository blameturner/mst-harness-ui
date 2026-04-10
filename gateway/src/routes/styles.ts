import { Hono } from 'hono';
import { FetchTimeoutError } from '../lib/fetch-with-timeout.js';
import { listStyles } from '../services/harness/index.js';


export const stylesRoute = new Hono();

const TTL_MS = 24 * 60 * 60 * 1000;

interface CacheEntry {
  body: unknown;
  expiresAt: number;
}
const cache = new Map<string, CacheEntry>();

stylesRoute.get('/', async (c) => {
  const surfaceParam = c.req.query('surface');
  const surface =
    surfaceParam === 'chat' || surfaceParam === 'code' ? surfaceParam : undefined;
  const cacheKey = surface ?? '__all__';

  const now = Date.now();
  const hit = cache.get(cacheKey);
  if (hit && hit.expiresAt > now) {
    return c.json(hit.body as Record<string, unknown>, 200, {
      'Cache-Control': `public, max-age=${Math.floor((hit.expiresAt - now) / 1000)}`,
      'X-Gateway-Cache': 'HIT',
    });
  }

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
    cache.set(cacheKey, { body, expiresAt: now + TTL_MS });
    return c.json(body as Record<string, unknown>, 200, {
      'Cache-Control': `public, max-age=${Math.floor(TTL_MS / 1000)}`,
      'X-Gateway-Cache': 'MISS',
    });
  } catch (err) {
    if (err instanceof FetchTimeoutError) {
      return c.json({ error: 'harness_timeout' }, 504);
    }
    console.error('[styles] harness unreachable', err);
    return c.json({ error: 'harness_unreachable' }, 502);
  }
});
