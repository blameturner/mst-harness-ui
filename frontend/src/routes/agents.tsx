import { createFileRoute } from '@tanstack/react-router';
import { requireSession } from "../lib/route-guards";
import { AgentsPage } from '../features/agents-v2/AgentsPage';

export const Route = createFileRoute('/agents')({
  beforeLoad: async () => {
    await requireSession();
  },
  component: AgentsPage,
});
