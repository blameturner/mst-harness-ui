import { createFileRoute, redirect } from '@tanstack/react-router';
import { api } from '../lib/api';
import { authClient } from '../lib/auth-client';

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    try {
      const status = await api.setupStatus();
      if (!status.configured) {
        throw redirect({ to: '/setup' });
      }
    } catch (err) {
      // TanStack router redirects/not-founds must be re-thrown unchanged.
      if ((err as any)?.routerCode) throw err;
      // Genuine fetch failure (gateway unreachable, 5xx, etc). Log for ops
      // visibility and fall through to /setup as a best-effort recovery —
      // the setup POST will 409 if the system is already configured, so this
      // cannot corrupt state.
      console.error('[index] setup status check failed', err);
      throw redirect({ to: '/setup' });
    }
    const session = await authClient.getSession();
    if (!session.data?.user) {
      throw redirect({ to: '/login' });
    }
    throw redirect({ to: '/chat' });
  },
  component: () => null,
});
