import { createFileRoute, redirect } from '@tanstack/react-router';
import { setupStatus } from '../api/auth/setupStatus';
import { authClient } from '../lib/auth-client';
import { HomePage } from '../features/home/HomePage';

export const Route = createFileRoute('/home')({
  validateSearch: (search) => ({
    tab:
      typeof search.tab === 'string' &&
      ['dashboard', 'logs', 'stats', 'queue', 'connectors'].includes(search.tab)
        ? (search.tab as 'dashboard' | 'logs' | 'stats' | 'queue' | 'connectors')
        : undefined,
  }),
  beforeLoad: async () => {
    try {
      const status = await setupStatus();
      if (!status.configured) {
        throw redirect({ to: '/setup' });
      }
    } catch (err) {
      // Router redirects/not-founds must be re-thrown unchanged
      if ((err as any)?.routerCode) throw err;
      console.error('[home] setup status check failed', err);
      throw redirect({ to: '/setup' });
    }
    const session = await authClient.getSession();
    if (!session.data?.user) {
      throw redirect({ to: '/login' });
    }
  },
  component: HomePage,
});
