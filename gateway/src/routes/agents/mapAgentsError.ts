// intentionally not dedupe'd with lib/mapHarnessError — log format differs for this router
import { FetchTimeoutError } from '../../lib/FetchTimeoutError.js';

export function mapAgentsError(err: unknown, tag: string) {
  if (err instanceof FetchTimeoutError) {
    return new Response(JSON.stringify({ error: 'harness_timeout' }), {
      status: 504,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  console.error(`[agents] ${tag} harness unreachable`, err);
  return new Response(JSON.stringify({ error: 'harness_unreachable' }), {
    status: 502,
    headers: { 'Content-Type': 'application/json' },
  });
}
