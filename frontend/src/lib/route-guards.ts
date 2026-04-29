import { redirect } from '@tanstack/react-router';
import { authClient } from './auth-client';

/**
 * Route-guard helper for `beforeLoad`. Redirects to /login only on a
 * *successful* "no session" response. Transient failures (429 from the auth
 * rate limiter, 5xx, network) fall through silently — bouncing a logged-in
 * user to /login on a transient error sends them straight into the auth-bucket
 * trap, where their sign-in attempt also 429s.
 */
export async function requireSession() {
  try {
    const session = await authClient.getSession();
    if (!session.error && !session.data?.user) {
      throw redirect({ to: '/login' });
    }
  } catch (err) {
    if ((err as { routerCode?: unknown })?.routerCode) throw err;
    console.error('[route-guard] session check failed', err);
  }
}
