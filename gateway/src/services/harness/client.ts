import { env } from '../../env.js';
import { fetchWithTimeout } from '../../lib/fetch-with-timeout.js';

/**
 * Thin typed wrapper around fetch() for the Harness HTTP API. The only place in the
 * codebase that knows about `HARNESS_URL` — routes should call functions in `./endpoints.ts`.
 */
export const harnessClient = {
  get(path: string, timeoutMs: number): Promise<Response> {
    return fetchWithTimeout(`${env.HARNESS_URL}${path}`, { method: 'GET' }, timeoutMs);
  },
  post(path: string, body: unknown, timeoutMs: number): Promise<Response> {
    return fetchWithTimeout(
      `${env.HARNESS_URL}${path}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
      timeoutMs,
    );
  },
};
