import { createFileRoute } from '@tanstack/react-router';
import { requireSession } from '../lib/route-guards';
import { ProjectsPage } from '../features/projects/ProjectsPage';

export const Route = createFileRoute('/projects')({
  beforeLoad: async () => {
    await requireSession();
  },
  component: ProjectsPage,
});
