import { createFileRoute, redirect } from '@tanstack/react-router';
import { setupStatus } from '../api/auth/setupStatus';
import { requireSession } from '../lib/route-guards';

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    // See note in routes/home.tsx — only redirect on a successful
    // "not configured" answer; treat errors as "trust the session".
    try {
      const status = await setupStatus();
      if (!status.configured) {
        throw redirect({ to: '/setup' });
      }
    } catch (err) {
      if ((err as any)?.routerCode) throw err;
      console.error('[index] setup status check failed', err);
    }
    await requireSession();
    throw redirect({ to: '/home', search: { tab: undefined } });
  },
  component: () => null,
});
