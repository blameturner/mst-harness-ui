import { useState } from 'react';
import type { ResearchPlan } from '../../../../api/types/Enrichment';
import { ConfidenceMeter } from './ConfidenceMeter';
import { GapReportPanel } from './GapReportPanel';
import { STATUS_TONES, parseGapReport } from './confidence';

interface Props {
  plan: ResearchPlan;
  busyAction: string | null;
  onRunAgent: (id: number) => void;
  onComplete: (id: number) => void;
  onDelete: (id: number) => void;
  onViewPaper: (plan: ResearchPlan) => void;
  onSaveQueries: (id: number, queries: string[]) => void;
}

export function ResearchPlanCard({
  plan,
  busyAction,
  onRunAgent,
  onComplete,
  onDelete,
  onViewPaper,
  onSaveQueries,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [editingQueries, setEditingQueries] = useState(false);
  const [draftQueries, setDraftQueries] = useState<string>(plan.queries?.join('\n') ?? '');

  const gap = parseGapReport(plan.gap_report);
  const score = plan.confidence_score ?? gap?.confidence_score ?? 0;
  const threshold = plan.confidence_threshold ?? 80;
  const iter = plan.iterations ?? 0;
  const maxIter = plan.max_iterations ?? 3;
  const hasPaper = !!plan.paper_content;
  const isComplete = plan.status === 'complete' || plan.status === 'completed';
  const isBusy = busyAction != null;
  const inFlight = ['generating', 'synthesizing', 'critiquing'].includes(plan.status);

  function commitQueries() {
    const queries = draftQueries
      .split('\n')
      .map((q) => q.trim())
      .filter(Boolean);
    onSaveQueries(plan.Id, queries);
    setEditingQueries(false);
  }

  return (
    <div className="border border-border rounded bg-panel/40 overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <h3 className="text-sm font-sans text-fg">{plan.topic}</h3>
              <span
                className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-[0.1em] ${STATUS_TONES[plan.status] ?? 'bg-muted/30 text-muted'}`}
              >
                {inFlight && (
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-current mr-1.5 animate-pulse" />
                )}
                {plan.status}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted">
              <span>
                Iterations <span className="font-mono text-fg">{iter}/{maxIter}</span>
              </span>
              <span>Hypotheses {plan.hypotheses?.length ?? 0}</span>
              <span>Sub-topics {plan.sub_topics?.length ?? 0}</span>
              <span>Queries {plan.queries?.length ?? 0}</span>
              <ConfidenceMeter score={score} compact />
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onViewPaper(plan)}
              disabled={!hasPaper}
              className="px-3 py-1 rounded border border-border text-[10px] uppercase tracking-[0.14em] hover:bg-panel disabled:opacity-40 disabled:cursor-not-allowed"
              title={hasPaper ? 'View paper' : 'No paper yet'}
            >
              View Paper
            </button>
            <button
              onClick={() => onRunAgent(plan.Id)}
              disabled={isBusy || isComplete}
              className="px-3 py-1 rounded bg-fg text-bg text-[10px] uppercase tracking-[0.14em] hover:bg-fg/90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {busyAction === `run:${plan.Id}` ? 'Running...' : 'Run Agent'}
            </button>
            <button
              onClick={() => {
                if (confirm(`Delete plan "${plan.topic}"?`)) onDelete(plan.Id);
              }}
              disabled={isBusy}
              className="px-3 py-1 rounded border border-border text-[10px] uppercase tracking-[0.14em] text-red-600 hover:bg-red-500/10 hover:border-red-500/40 disabled:opacity-40"
            >
              Delete
            </button>
            <button
              onClick={() => setExpanded((v) => !v)}
              className="px-2 py-1 rounded border border-border text-[10px] uppercase tracking-[0.14em] hover:bg-panel"
            >
              {expanded ? '−' : '+'}
            </button>
          </div>
        </div>

        <div className="mt-3">
          <ConfidenceMeter score={score} threshold={threshold} />
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border p-4 space-y-4 bg-bg">
          {gap && (
            <GapReportPanel
              report={gap}
              threshold={threshold}
              busy={isBusy}
              onRerun={isComplete ? undefined : () => onRunAgent(plan.Id)}
              onComplete={isComplete ? undefined : () => onComplete(plan.Id)}
            />
          )}

          {plan.hypotheses?.length > 0 && (
            <Section label="Hypotheses">
              <ul className="text-xs text-fg space-y-1">
                {plan.hypotheses.map((h, i) => (
                  <li key={i}>• {h}</li>
                ))}
              </ul>
            </Section>
          )}

          {plan.sub_topics?.length > 0 && (
            <Section label="Sub-topics">
              <div className="flex flex-wrap gap-1.5">
                {plan.sub_topics.map((t, i) => (
                  <span key={i} className="px-2 py-0.5 rounded bg-panel border border-border text-[11px]">
                    {t}
                  </span>
                ))}
              </div>
            </Section>
          )}

          <Section
            label="Queries"
            action={
              editingQueries ? (
                <div className="flex gap-1">
                  <button
                    onClick={commitQueries}
                    className="text-[10px] uppercase tracking-[0.14em] text-fg hover:underline"
                  >
                    Save
                  </button>
                  <span className="text-muted text-[10px]">·</span>
                  <button
                    onClick={() => {
                      setDraftQueries(plan.queries?.join('\n') ?? '');
                      setEditingQueries(false);
                    }}
                    className="text-[10px] uppercase tracking-[0.14em] text-muted hover:text-fg"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setEditingQueries(true)}
                  className="text-[10px] uppercase tracking-[0.14em] text-muted hover:text-fg"
                >
                  Edit
                </button>
              )
            }
          >
            {editingQueries ? (
              <textarea
                value={draftQueries}
                onChange={(e) => setDraftQueries(e.target.value)}
                rows={Math.max(4, draftQueries.split('\n').length + 1)}
                placeholder="One query per line"
                className="w-full px-3 py-2 rounded border border-border bg-panel text-fg text-xs font-mono focus:outline-none focus:border-fg"
              />
            ) : plan.queries?.length > 0 ? (
              <ul className="text-xs text-fg space-y-1 font-mono">
                {plan.queries.map((q, i) => (
                  <li key={i}>• {q}</li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted italic">No queries</p>
            )}
          </Section>

          {plan.schema && Object.keys(plan.schema).length > 0 && (
            <Section label="Schema">
              <pre className="text-xs font-mono text-fg bg-panel p-2 rounded overflow-x-auto">
                {JSON.stringify(plan.schema, null, 2)}
              </pre>
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function Section({
  label,
  action,
  children,
}: {
  label: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[10px] uppercase tracking-[0.14em] text-muted">{label}</p>
        {action}
      </div>
      {children}
    </div>
  );
}
