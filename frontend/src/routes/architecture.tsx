import { createFileRoute } from '@tanstack/react-router';
import { requireSession } from "../lib/route-guards";
import { ArchitecturePage } from '../features/architecture/ArchitecturePage';

export const Route = createFileRoute('/architecture')({
  beforeLoad: async () => {
    await requireSession();
  },
  component: ArchitecturePage,
});
