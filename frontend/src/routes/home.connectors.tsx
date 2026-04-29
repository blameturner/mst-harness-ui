import { createFileRoute, redirect } from '@tanstack/react-router';
import { requireSession } from "../lib/route-guards";

export const Route = createFileRoute('/home/connectors')({
  beforeLoad: async () => {
    await requireSession();
    throw redirect({ to: '/home', search: { tab: 'connectors' } });
  },
  component: () => null,
});
