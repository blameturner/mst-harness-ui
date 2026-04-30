import { createFileRoute } from '@tanstack/react-router';
import { requireSession } from '../lib/route-guards';
import { EnrichmentPage } from '../features/enrichment/EnrichmentPage';

export const Route = createFileRoute('/enrichment')({
  beforeLoad: async () => {
    await requireSession();
  },
  component: EnrichmentPage,
});
