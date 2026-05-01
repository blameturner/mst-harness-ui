import { createFileRoute } from '@tanstack/react-router';
import { requireSession } from '../lib/route-guards';
import { ProjectWorkspace } from '../features/projects/ProjectWorkspace';

export const Route = createFileRoute('/projects/$id')({
  beforeLoad: async () => {
    await requireSession();
  },
  component: ProjectWorkspaceRoute,
});

function ProjectWorkspaceRoute() {
  const { id } = Route.useParams();
  const num = parseInt(id, 10);
  if (!Number.isFinite(num)) return <div className="p-4 text-red-600">Invalid project id</div>;
  return <ProjectWorkspace projectId={num} />;
}
