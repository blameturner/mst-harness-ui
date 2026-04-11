import { FetchTimeoutError } from '../../lib/FetchTimeoutError.js';

export function mapCodebasesError(err: unknown) {
  if (err instanceof FetchTimeoutError) return new Response(JSON.stringify({ error: 'harness_timeout' }), { status: 504, headers: { 'Content-Type': 'application/json' } });
  console.error('[codebases] harness unreachable', err);
  return new Response(JSON.stringify({ error: 'harness_unreachable' }), { status: 502, headers: { 'Content-Type': 'application/json' } });
}
