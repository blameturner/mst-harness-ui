import { createFileRoute, Link, redirect, useParams } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import type { AgentOutputRow } from '../api/types/AgentOutputRow';
import type { AgentRun } from '../api/types/AgentRun';
import { getAgentRuns } from '../api/agents/getAgentRuns';
import { getAgentOutputs } from '../api/agents/getAgentOutputs';
import { authClient } from '../lib/auth-client';

function RunDetailPage() {
  const { id, runId } = useParams({ from: '/agents/$id/runs/$runId' });
  const agentId = Number(id);
  const runIdNum = Number(runId);
  const [run, setRun] = useState<AgentRun | null>(null);
  const [outputs, setOutputs] = useState<AgentOutputRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [runsRes, outputsRes] = await Promise.all([
          getAgentRuns(agentId),
          getAgentOutputs(agentId),
        ]);
        if (cancelled) return;
        setRun(runsRes.runs.find((r) => r.Id === runIdNum) ?? null);
        setOutputs(outputsRes.outputs.filter((o) => o.run_id === runIdNum));
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
  }, [agentId, runIdNum]);

  return (
    <div className="min-h-full bg-bg text-fg font-sans">
      <header className="border-b border-border px-8 py-5 flex items-baseline gap-6">
        <Link
          to="/agents/$id"
          params={{ id: String(agentId) }}
          className="text-xs uppercase tracking-[0.2em] text-muted font-sans"
        >
          ← agent
        </Link>
        <h1 className="font-display text-2xl tracking-tightest">Run {runIdNum}</h1>
      </header>

      <main className="px-8 py-6 space-y-6">
        {error && <div className="text-xs font-sans text-red-700">{error}</div>}
        {loading ? (
          <div className="text-sm text-muted">Loading…</div>
        ) : !run ? (
          <div className="text-sm text-muted font-sans">Run not found.</div>
        ) : (
          <>
            <section className="bg-panel border border-border p-4 grid grid-cols-3 gap-4 text-sm">
              <Field label="status" value={run.status} />
              <Field label="model" value={run.model_name ?? '—'} />
              <Field
                label="duration"
                value={run.duration_seconds != null ? `${run.duration_seconds.toFixed(1)}s` : '—'}
              />
              <Field label="tokens in" value={String(run.tokens_input ?? 0)} />
              <Field label="tokens out" value={String(run.tokens_output ?? 0)} />
              <Field label="created" value={run.CreatedAt ?? '—'} />
              {run.summary && (
                <div className="col-span-3">
                  <div className="text-[10px] uppercase tracking-[0.14em] font-sans text-muted mb-1">
                    summary
                  </div>
                  <div className="text-sm">{run.summary}</div>
                </div>
              )}
            </section>

            <section>
              <h2 className="font-display text-lg mb-2">Outputs</h2>
              {outputs.length === 0 ? (
                <div className="text-sm text-muted font-sans">No outputs.</div>
              ) : (
                outputs.map((o) => (
                  <div key={o.Id} className="border border-border bg-panel p-4 mb-3">
                    <pre className="whitespace-pre-wrap text-sm font-sans">
                      {o.full_text ?? ''}
                    </pre>
                  </div>
                ))
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.14em] font-sans text-muted">{label}</div>
      <div className="font-sans text-xs mt-0.5">{value}</div>
    </div>
  );
}

export const Route = createFileRoute('/agents/$id/runs/$runId')({
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data?.user) {
      throw redirect({ to: '/login' });
    }
  },
  component: RunDetailPage,
});
