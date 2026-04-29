import { createFileRoute } from '@tanstack/react-router';
import { requireSession } from "../lib/route-guards";
import { ResearchTab } from '../features/home/tabs/ResearchTab';

export const Route = createFileRoute('/research')({
  beforeLoad: async () => {
    await requireSession();
  },
  component: ResearchTab,
});

