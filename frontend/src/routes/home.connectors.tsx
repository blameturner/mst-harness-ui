import { createFileRoute, redirect } from '@tanstack/react-router';
import { authClient } from '../lib/auth-client';

export const Route = createFileRoute('/home/connectors')({
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data?.user) {
      throw redirect({ to: '/login' });
    }
    throw redirect({ to: '/home', search: { tab: 'connectors' } });
  },
  component: () => null,
});
