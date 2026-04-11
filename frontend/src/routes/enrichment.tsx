import { createFileRoute, redirect } from '@tanstack/react-router';
import { authClient } from '../lib/auth-client';
import { EnrichmentPage } from '../features/enrichment/EnrichmentPage';

export const Route = createFileRoute('/enrichment')({
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data?.user) {
      throw redirect({ to: '/login' });
    }
  },
  component: EnrichmentPage,
});
