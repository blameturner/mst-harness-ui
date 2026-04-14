import { useEffect, useState } from 'react';
import { createResearchPlan, listResearchPlans, getNextResearchPlan, completeResearchPlan } from '../../../api/enrichment/research';
import type { ResearchPlan } from '../../../api/types/Enrichment';

export function ResearchTab() {
  const [topic, setTopic] = useState('');
  const [plans, setPlans] = useState<ResearchPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    loadPlans();
  }, []);

  function loadPlans() {
    setLoading(true);
    listResearchPlans()
      .then((res) => setPlans(res.items))
      .catch(() => {})
      .finally(() => setLoading(false));
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

  async function handleProcessNext() {
    try {
      await getNextResearchPlan();
      loadPlans();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleComplete(planId: number) {
    try {
      await completeResearchPlan(planId);
      loadPlans();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const statusColors: Record<string, string> = {
    pending: 'bg-muted/40 text-muted',
    generating: 'bg-blue-500/20 text-blue-400',
    complete: 'bg-emerald-500/20 text-emerald-400',
    failed: 'bg-red-500/20 text-red-400',
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-end gap-4">
        <div className="flex-1">
          <label className="block text-[11px] uppercase tracking-[0.14em] text-muted mb-1.5">Topic</label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Enter research topic..."
            className="w-full px-3 py-2 rounded border border-border bg-panel text-fg text-sm font-sans focus:outline-none focus:border-fg"
          />
        </div>
        <button
          onClick={handleGenerate}
          disabled={!topic || generating}
          className="px-4 py-2 rounded bg-fg text-bg text-[11px] uppercase tracking-[0.14em] font-sans hover:bg-fg/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generating ? 'Generating...' : 'Generate'}
        </button>
        <button
          onClick={handleProcessNext}
          className="px-4 py-2 rounded border border-border text-[11px] uppercase tracking-[0.14em] font-sans hover:bg-panel"
        >
          Process Next
        </button>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="grid gap-4">
        {loading ? (
          <p className="text-center text-muted text-xs py-8">Loading...</p>
        ) : plans.length === 0 ? (
          <p className="text-center text-muted text-xs py-8">No research plans yet</p>
        ) : (
          plans.map((plan) => (
            <div
              key={plan.Id}
              className="border border-border rounded p-4 bg-panel/40 hover:bg-panel/60 transition-colors"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-sans text-fg truncate">{plan.topic}</h3>
                    <span className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-[0.1em] shrink-0 ${statusColors[plan.status]}`}>
                      {plan.status}
                    </span>
                  </div>
                  <div className="flex gap-4 mt-2 text-[11px] text-muted">
                    <span>Hypotheses: {plan.hypotheses?.length ?? 0}</span>
                    <span>Sub-topics: {plan.sub_topics?.length ?? 0}</span>
                    <span>Queries: {plan.queries?.length ?? 0}</span>
                  </div>
                </div>
                <button
                  onClick={() => setExpandedId(expandedId === plan.Id ? null : plan.Id)}
                  className="px-3 py-1 rounded border border-border text-[10px] uppercase tracking-[0.14em] font-sans hover:bg-panel shrink-0"
                >
                  {expandedId === plan.Id ? 'Collapse' : 'Expand'}
                </button>
                {plan.status === 'generating' && (
                  <button
                    onClick={() => handleComplete(plan.Id)}
                    className="px-3 py-1 rounded bg-fg text-bg text-[10px] uppercase tracking-[0.14em] font-sans hover:bg-fg/90 shrink-0"
                  >
                    Complete
                  </button>
                )}
              </div>

              {expandedId === plan.Id && (
                <div className="mt-4 pt-4 border-t border-border space-y-4">
                  {plan.schema && Object.keys(plan.schema).length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.14em] text-muted mb-1">Schema</p>
                      <pre className="text-xs font-mono text-fg bg-panel p-2 rounded overflow-x-auto">
                        {JSON.stringify(plan.schema, null, 2)}
                      </pre>
                    </div>
                  )}
                  {plan.hypotheses && plan.hypotheses.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.14em] text-muted mb-1">Hypotheses</p>
                      <ul className="text-xs text-fg space-y-1">
                        {plan.hypotheses.map((h, i) => (
                          <li key={i}>• {h}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {plan.queries && plan.queries.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.14em] text-muted mb-1">Queries</p>
                      <ul className="text-xs text-fg space-y-1">
                        {plan.queries.map((q, i) => (
                          <li key={i}>• {q}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}