import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createResearchPlan,
  listResearchPlans,
  nextResearchAgent,
  runResearchAgent,
  completeResearchPlan,
  deleteResearchPlan,
  updateResearchPlanQueries,
} from '../../../api/enrichment/research';
import type { ResearchPlan } from '../../../api/types/Enrichment';
import { ResearchPlanCard } from './research/ResearchPlanCard';

type StatusFilter = 'all' | 'active' | 'complete' | 'failed';

export function ResearchTab() {
  const [topic, setTopic] = useState('');
  const [plans, setPlans] = useState<ResearchPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    loadPlans();
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, []);

  useEffect(() => {
    const hasInflight = plans.some((p) =>
      ['generating', 'synthesizing', 'critiquing'].includes(p.status)
    );
    if (hasInflight && pollRef.current == null) {
      pollRef.current = window.setInterval(loadPlans, 4000);
    } else if (!hasInflight && pollRef.current != null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, [plans]);

  function loadPlans() {
    setLoading(true);
    listResearchPlans()
      .then((res) => setPlans(res?.items ?? []))
      .catch((err) => {
        console.error('[research] listResearchPlans failed', err);
        setError((err as Error)?.message ?? 'Failed to load research plans');
      })
      .finally(() => setLoading(false));
  }

  async function withAction<T>(key: string, fn: () => Promise<T>) {
    setBusyAction(key);
    setError(null);
    try {
      await fn();
      loadPlans();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyAction(null);
    }
  }

  async function handleGenerate() {
    if (!topic) return;
    setGenerating(true);
    setError(null);
    try {
      await createResearchPlan({ topic });
      setTopic('');
      loadPlans();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  const stats = useMemo(() => {
    const total = plans.length;
    const completed = plans.filter((p) => p.status === 'completed').length;
    const papers = plans.filter((p) => !!p.paper_content).length;
    const scores = plans.map((p) => p.confidence_score ?? 0).filter((s) => s > 0);
    const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    const iterations = plans.map((p) => p.iterations ?? 0);
    const avgIter = iterations.length ? Math.round((iterations.reduce((a, b) => a + b, 0) / iterations.length) * 10) / 10 : 0;
    return { total, completed, papers, avgScore, avgIter };
  }, [plans]);

  const visiblePlans = useMemo(() => {
    if (filter === 'all') return plans;
    if (filter === 'complete') return plans.filter((p) => p.status === 'completed');
    if (filter === 'failed') return plans.filter((p) => p.status === 'failed');
    return plans.filter((p) => !['completed', 'failed'].includes(p.status));
  }, [plans, filter]);

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <Stat label="Plans" value={stats.total} />
        <Stat label="Completed" value={stats.completed} />
        <Stat label="Papers" value={stats.papers} />
        <Stat label="Avg Confidence" value={`${stats.avgScore}%`} />
        <Stat label="Avg Iterations" value={stats.avgIter} />
      </div>

      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="block text-[11px] uppercase tracking-[0.14em] text-muted mb-1.5">Topic</label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleGenerate();
            }}
            placeholder="Enter research topic..."
            className="w-full px-3 py-2 rounded border border-border bg-panel text-fg text-sm font-sans focus:outline-none focus:border-fg"
          />
        </div>
        <button
          onClick={handleGenerate}
          disabled={!topic || generating}
          className="px-4 py-2 rounded bg-fg text-bg text-[11px] uppercase tracking-[0.14em] font-sans hover:bg-fg/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generating ? 'Generating...' : 'Create Plan'}
        </button>
        <button
          onClick={() => withAction('next', () => nextResearchAgent())}
          disabled={busyAction != null}
          className="px-4 py-2 rounded border border-border text-[11px] uppercase tracking-[0.14em] font-sans hover:bg-panel disabled:opacity-50"
        >
          {busyAction === 'next' ? 'Working...' : 'Process Next'}
        </button>
        <button
          onClick={loadPlans}
          disabled={loading}
          className="px-3 py-2 rounded border border-border text-[11px] uppercase tracking-[0.14em] font-sans hover:bg-panel disabled:opacity-50"
          title="Refresh"
        >
          ↻
        </button>
      </div>

      {error && (
        <div className="px-3 py-2 rounded bg-red-500/10 border border-red-500/30 text-xs text-red-600">
          {error}
        </div>
      )}

      <div className="flex items-center gap-1 border-b border-border">
        {(['all', 'active', 'complete', 'failed'] as StatusFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={[
              'px-3 py-2 text-[10px] uppercase tracking-[0.14em] border-b-2 -mb-px transition-colors',
              filter === f ? 'border-fg text-fg' : 'border-transparent text-muted hover:text-fg',
            ].join(' ')}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="grid gap-3">
        {loading && plans.length === 0 ? (
          <p className="text-center text-muted text-xs py-8">Loading...</p>
        ) : visiblePlans.length === 0 ? (
          <p className="text-center text-muted text-xs py-8">
            {plans.length === 0 ? 'No research plans yet' : `No ${filter} plans`}
          </p>
        ) : (
          visiblePlans.map((plan) => (
            <ResearchPlanCard
              key={plan.Id}
              plan={plan}
              busyAction={busyAction}
              onRunAgent={(id) => withAction(`run:${id}`, () => runResearchAgent({ plan_id: id }))}
              onComplete={(id) => withAction(`complete:${id}`, () => completeResearchPlan(id))}
              onDelete={(id) => withAction(`delete:${id}`, () => deleteResearchPlan(id))}
              onSaveQueries={(id, queries) =>
                withAction(`save:${id}`, () => updateResearchPlanQueries(id, queries))
              }
            />
          ))
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="border border-border rounded px-3 py-2 bg-panel/40">
      <p className="text-[10px] uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="text-lg font-display tracking-tight text-fg">{value}</p>
    </div>
  );
}
