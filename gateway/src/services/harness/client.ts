import { env } from '../../env.js';
import { fetchWithTimeout } from '../../lib/fetchWithTimeout.js';

// Only place that knows about HARNESS_URL — routes should call functions in ./endpoints/ instead.
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
  patch(path: string, body: unknown, timeoutMs: number): Promise<Response> {
    return fetchWithTimeout(
      `${env.HARNESS_URL}${path}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
      timeoutMs,
    );
  },
  delete(path: string, timeoutMs: number): Promise<Response> {
    return fetchWithTimeout(`${env.HARNESS_URL}${path}`, { method: 'DELETE' }, timeoutMs);
  },
};
