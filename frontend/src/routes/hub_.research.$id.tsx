import { createFileRoute, Link, redirect, useParams } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import type { ResearchPlan } from '../api/types/Enrichment';
import { getResearchPlan } from '../api/enrichment/research';
import { authClient } from '../lib/auth-client';
import { ResearchPaperPage } from '../features/hub/tabs/research/ResearchPaperPage';

function ResearchPaperRoute() {
  const { id } = useParams({ from: '/hub_/research/$id' });
  const planId = Number(id);
  const [plan, setPlan] = useState<ResearchPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await getResearchPlan(planId);
        if (!cancelled) setPlan(res);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [planId]);

  return (
    <div className="min-h-full bg-bg text-fg font-sans">
      <div className="border-b border-border px-6 py-3">
        <Link
          to="/hub"
          className="text-xs uppercase tracking-[0.2em] text-muted font-sans hover:text-fg"
        >
          ← hub
        </Link>
      </div>

      {error ? (
        <div className="px-6 py-6">
          <div className="px-3 py-2 rounded bg-red-500/10 border border-red-500/30 text-xs text-red-600">
            {error}
          </div>
        </div>
      ) : loading ? (
        <div className="px-6 py-8 text-sm text-muted">Loading…</div>
      ) : !plan ? (
        <div className="px-6 py-8 text-sm text-muted">Plan not found.</div>
      ) : (
        <ResearchPaperPage plan={plan} />
      )}
    </div>
  );
}

export const Route = createFileRoute('/hub_/research/$id')({
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data?.user) {
      throw redirect({ to: '/login' });
    }
  },
  component: ResearchPaperRoute,
});
