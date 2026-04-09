import { createFileRoute, Link, redirect, useParams } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import {
  api,
  type AgentOutputRow,
  type AgentRun,
  type AgentSummary,
} from '../lib/api';
import { authClient } from '../lib/auth-client';

type Tab = 'runs' | 'outputs';

function AgentDetailPage() {
  const { id } = useParams({ from: '/agents/$id' });
  const agentId = Number(id);
  const [agent, setAgent] = useState<AgentSummary | null>(null);
  const [tab, setTab] = useState<Tab>('runs');
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [outputs, setOutputs] = useState<AgentOutputRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [agentRes, runsRes, outputsRes] = await Promise.all([
          api.agents.get(agentId),
          api.agents.runs(agentId),
          api.agents.outputs(agentId),
        ]);
        if (cancelled) return;
        setAgent(agentRes);
        setRuns(runsRes.runs);
        setOutputs(outputsRes.outputs);
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
  }, [agentId]);

  return (
    <div className="min-h-full bg-bg text-fg font-sans">
      <header className="border-b border-border px-8 py-5 flex items-baseline gap-6">
        <Link to="/agents" className="text-xs uppercase tracking-[0.2em] text-muted font-sans">
          ← agents
        </Link>
        <h1 className="font-display text-2xl tracking-tightest">
          {agent?.display_name ?? agent?.name ?? `Agent ${agentId}`}
        </h1>
        {agent?.model && (
          <span className="text-xs font-sans text-muted">{agent.model}</span>
        )}
      </header>

      <nav className="border-b border-border px-8 flex gap-1">
        {(['runs', 'outputs'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={[
              'px-4 py-3 text-[11px] uppercase tracking-[0.18em] font-sans border-b-2 -mb-px transition-colors',
              tab === t ? 'border-fg text-fg' : 'border-transparent text-muted hover:text-fg',
            ].join(' ')}
          >
            {t}
          </button>
        ))}
      </nav>

      <main className="px-8 py-6">
        {error && <div className="text-xs font-sans text-red-700 mb-3">{error}</div>}
        {loading ? (
          <div className="text-sm text-muted">Loading…</div>
        ) : tab === 'runs' ? (
          runs.length === 0 ? (
            <div className="text-sm text-muted font-sans">No runs yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-[0.16em] text-muted font-sans border-b border-border">
                  <th className="text-left py-2">id</th>
                  <th className="text-left py-2">status</th>
                  <th className="text-left py-2">model</th>
                  <th className="text-right py-2">tokens in/out</th>
                  <th className="text-right py-2">duration</th>
                  <th className="text-left py-2">created</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.Id} className="border-b border-border hover:bg-panelHi">
                    <td className="py-2 font-sans text-xs">
                      <Link
                        to="/agents/$id/runs/$runId"
                        params={{ id: String(agentId), runId: String(r.Id) }}
                        className="underline"
                      >
                        {r.Id}
                      </Link>
                    </td>
                    <td className="py-2 font-sans text-xs">{r.status}</td>
                    <td className="py-2 font-sans text-xs">{r.model_name ?? '—'}</td>
                    <td className="py-2 text-right font-sans text-xs">
                      {r.tokens_input ?? 0} / {r.tokens_output ?? 0}
                    </td>
                    <td className="py-2 text-right font-sans text-xs">
                      {r.duration_seconds != null ? `${r.duration_seconds.toFixed(1)}s` : '—'}
                    </td>
                    <td className="py-2 text-xs text-muted">{r.CreatedAt ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : outputs.length === 0 ? (
          <div className="text-sm text-muted font-sans">No outputs.</div>
        ) : (
          <div className="space-y-4">
            {outputs.map((o) => (
              <div key={o.Id} className="border border-border bg-panel p-4">
                <div className="text-[10px] uppercase tracking-[0.14em] font-sans text-muted mb-2">
                  run {o.run_id} · {o.CreatedAt ?? ''}
                </div>
                <pre className="whitespace-pre-wrap text-sm text-fg font-sans">
                  {o.full_text ?? ''}
                </pre>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export const Route = createFileRoute('/agents/$id')({
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (!session.data?.user) {
      throw redirect({ to: '/login' });
    }
  },
  component: AgentDetailPage,
});
