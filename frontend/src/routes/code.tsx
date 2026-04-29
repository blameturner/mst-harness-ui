import { createFileRoute } from '@tanstack/react-router';
import { requireSession } from "../lib/route-guards";
import { CodePage } from '../features/code/CodePage';

export const Route = createFileRoute('/code')({
  beforeLoad: async () => {
    await requireSession();
  },
  component: CodePage,
});
