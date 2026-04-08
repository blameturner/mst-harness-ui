import type { Context, Next } from 'hono';

/**
 * Minimal in-memory fixed-window rate limiter. Suitable for a single-instance
 * LAN deployment (no Redis dep). Keyed by client IP (falls back to a constant
 * when the IP cannot be derived, which fails closed — all anon requests share
 * the same bucket).
 */
interface Bucket {
  count: number;
  resetAt: number;
}

export function rateLimit(opts: { windowMs: number; max: number; name?: string }) {
  const buckets = new Map<string, Bucket>();
  const { windowMs, max, name = 'rate' } = opts;

  return async function rateLimitMw(c: Context, next: Next) {
    const now = Date.now();
    const ip =
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
      c.req.header('x-real-ip') ||
      'unknown';
    const key = `${name}:${ip}`;

    let b = buckets.get(key);
    if (!b || b.resetAt < now) {
      b = { count: 0, resetAt: now + windowMs };
      buckets.set(key, b);
    }
    b.count += 1;

    // Opportunistic cleanup to keep the map bounded.
    if (buckets.size > 10_000) {
      for (const [k, v] of buckets) if (v.resetAt < now) buckets.delete(k);
    }

    if (b.count > max) {
      const retry = Math.ceil((b.resetAt - now) / 1000);
      c.header('Retry-After', String(retry));
      return c.json({ error: 'rate_limited' }, 429);
    }
    await next();
  };
}
