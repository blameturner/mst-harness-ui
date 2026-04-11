import { createFileRoute, redirect } from '@tanstack/react-router';
import { authClient } from '../lib/auth-client';
import { HarnessPage } from '../features/harness/HarnessPage';

export const Route = createFileRoute('/harness')({
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data?.user) throw redirect({ to: '/login' });
  },
  component: HarnessPage,
});
