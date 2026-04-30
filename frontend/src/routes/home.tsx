import { createFileRoute, redirect } from '@tanstack/react-router';
import { setupStatus } from '../api/auth/setupStatus';
import { requireSession } from '../lib/route-guards';
import { HomePage } from '../features/home/HomePage';

export const Route = createFileRoute('/home')({
  beforeLoad: async () => {
    // Only redirect to /setup on a *successful* "not configured" answer. If
    // the status endpoint errors (network, 429, 5xx) we trust the existing
    // session — bouncing a logged-in user to /setup on a transient failure
    // produces a stuck loop the user can only recover from by restarting the
    // gateway.
    try {
      const status = await setupStatus();
      if (!status.configured) {
        throw redirect({ to: '/setup' });
      }
    } catch (err) {
      if ((err as any)?.routerCode) throw err;
      console.error('[home] setup status check failed', err);
    }
    await requireSession();
  },
  component: HomePage,
});
