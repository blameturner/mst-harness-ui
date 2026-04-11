import { createFileRoute, redirect } from '@tanstack/react-router';
import { authClient } from '../lib/auth-client';
import { CodePage } from '../features/code/CodePage';

export const Route = createFileRoute('/code')({
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data?.user) {
      throw redirect({ to: '/login' });
    }
  },
  component: CodePage,
});
