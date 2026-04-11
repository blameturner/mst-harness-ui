import type { Context } from 'hono';
import type { AuthContext } from '../types/AuthContext.js';
import type { AuthVariables } from '../types/AuthVariables.js';

/**
 * Reads the auth context set by the requireAuth middleware. Safe to call from any
 * route mounted under `requireAuth` — the middleware guarantees these values exist.
 */
export function getAuthContext(c: Context<{ Variables: AuthVariables }>): AuthContext {
  return {
    userId: c.get('userId'),
    orgId: c.get('orgId'),
    email: c.get('email'),
  };
}
