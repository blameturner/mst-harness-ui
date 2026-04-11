import { createFileRoute, redirect } from '@tanstack/react-router';
import { authClient } from '../lib/auth-client';
import { ArchitecturePage } from '../features/architecture/ArchitecturePage';

export const Route = createFileRoute('/architecture')({
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data?.user) throw redirect({ to: '/login' });
  },
  component: ArchitecturePage,
});
