import { FetchTimeoutError } from './fetch-with-timeout.js';

export function mapHarnessError(err: unknown, tag: string): Response {
  if (err instanceof FetchTimeoutError) {
    return new Response(JSON.stringify({ error: 'harness_timeout' }), {
      status: 504,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  console.error(`[${tag}] harness unreachable`, err);
  return new Response(JSON.stringify({ error: 'harness_unreachable' }), {
    status: 502,
    headers: { 'Content-Type': 'application/json' },
  });
}
