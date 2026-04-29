import { createFileRoute } from '@tanstack/react-router';
import { requireSession } from "../lib/route-guards";
import { LogsPage } from '../features/logs/LogsPage';

export const Route = createFileRoute('/logs')({
  beforeLoad: async () => {
    await requireSession();
  },
  component: LogsPage,
});
