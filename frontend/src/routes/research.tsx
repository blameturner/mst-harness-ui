import { createFileRoute, redirect } from '@tanstack/react-router';
import { ResearchTab } from '../features/hub/tabs/ResearchTab';
import { authClient } from '../lib/auth-client';

export const Route = createFileRoute('/research')({
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data?.user) throw redirect({ to: '/login' });
  },
  component: ResearchTab,
});

