import { useState } from 'react';
import type { SearchStatus } from '../../api/types/SearchStatus';

interface PlanUrl {
  url: string;
  title: string;
  snippet?: string;
}

interface DeepSearchPlanData {
  queries: string[];
  urls: PlanUrl[];
}

interface ResearchPlanData {
  question: string;
  objective: string;
  queries: string[];
  lookout: string[];
  completion_criteria: string[];
}

interface Props {
  model?: string;
  searchStatus?: SearchStatus;
  searchContextText?: string;
  onApprove: () => void;
  onRevise: (feedback: string) => void;
}

function parsePlan(model: string | undefined, raw: string | undefined): { deep?: DeepSearchPlanData; research?: ResearchPlanData } | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (model === 'deep_search_plan') return { deep: data as DeepSearchPlanData };
    if (model === 'research_plan') return { research: data as ResearchPlanData };
  } catch {}
  return null;
}

export function PlanApprovalCard({ model, searchStatus, searchContextText, onApprove, onRevise }: Props) {
  const [revising, setRevising] = useState(false);
  const [feedback, setFeedback] = useState('');

  const isPlan = model === 'deep_search_plan' || model === 'research_plan';
  if (!isPlan) return null;

  const awaiting = searchStatus === 'awaiting_approval';
  const approved = searchStatus === 'approved';
  if (!awaiting && !approved) return null;

  const parsed = parsePlan(model, searchContextText);
  const isResearch = model === 'research_plan';
  const label = isResearch ? 'Research' : 'Deep Search';

  function handleReviseSubmit() {
    const text = feedback.trim();
    if (!text) return;
    onRevise(text);
    setRevising(false);
    setFeedback('');
  }

  return (
    <div className="mt-3 rounded-lg border border-border bg-bg/60 overflow-hidden">
      <div className="px-3 py-2 border-b border-border bg-panel/40 flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-[0.14em] font-sans text-muted">
          {label} Plan
        </span>
        {approved && (
          <span className="text-[10px] uppercase tracking-[0.14em] font-sans text-emerald-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Approved
          </span>
        )}
      </div>

      <div className="px-3 py-2.5 space-y-3">
        {/* Research-specific fields */}
        {parsed?.research && (
          <>
            <PlanSection label="Objective">
              <p className="text-[12px] text-fg leading-relaxed">{parsed.research.objective}</p>
            </PlanSection>
            {parsed.research.lookout.length > 0 && (
              <PlanSection label="Looking for">
                <ul className="text-[11px] text-muted space-y-0.5 list-disc list-inside">
                  {parsed.research.lookout.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </PlanSection>
            )}
            {parsed.research.completion_criteria.length > 0 && (
              <PlanSection label="Completion criteria">
                <ul className="text-[11px] text-muted space-y-0.5 list-disc list-inside">
                  {parsed.research.completion_criteria.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </PlanSection>
            )}
            <p className="text-[10px] text-muted italic">
              Will iterate up to 3 rounds until criteria are met
            </p>
          </>
        )}

        {/* Queries */}
        {(() => {
          const queries = parsed?.deep?.queries ?? parsed?.research?.queries ?? [];
          return queries.length > 0 ? (
            <PlanSection label="Queries">
              <div className="flex flex-wrap gap-1.5">
                {queries.map((q, i) => (
                  <span
                    key={i}
                    className="text-[11px] px-2 py-0.5 rounded-full bg-panelHi border border-border text-muted"
                  >
                    {q}
                  </span>
                ))}
              </div>
            </PlanSection>
          ) : null;
        })()}

        {/* URLs — deep search only */}
        {parsed?.deep && parsed.deep.urls.length > 0 && (
          <PlanSection label={`Sources (${parsed.deep.urls.length})`}>
            <div className="space-y-1">
              {parsed.deep.urls.map((u, i) => {
                let hostname = '';
                try { hostname = new URL(u.url).hostname; } catch {}
                return (
                  <a
                    key={i}
                    href={u.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="block text-[11px] text-muted hover:text-fg truncate"
                  >
                    <span className="text-fg font-medium">{u.title}</span>
                    {hostname && <span className="ml-1.5 text-[10px] text-muted">({hostname})</span>}
                  </a>
                );
              })}
            </div>
          </PlanSection>
        )}

        {/* Actions — only when awaiting approval */}
        {awaiting && (
          revising ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleReviseSubmit()}
                placeholder="How should the plan change?"
                autoFocus
                className="flex-1 text-[12px] px-2.5 py-1.5 rounded-md border border-border bg-bg text-fg placeholder:text-muted focus:outline-none focus:border-fg/40"
              />
              <button
                type="button"
                onClick={handleReviseSubmit}
                disabled={!feedback.trim()}
                className="text-[10px] uppercase tracking-[0.14em] font-sans px-3 py-1.5 rounded-md border border-fg/40 text-fg hover:bg-fg hover:text-bg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Send
              </button>
              <button
                type="button"
                onClick={() => { setRevising(false); setFeedback(''); }}
                className="text-[10px] uppercase tracking-[0.14em] font-sans px-2.5 py-1.5 text-muted hover:text-fg transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onApprove}
                className="text-[10px] uppercase tracking-[0.14em] font-sans px-3 py-1.5 rounded-md border border-emerald-600/60 text-emerald-400 hover:bg-emerald-600 hover:text-bg transition-colors"
              >
                Approve
              </button>
              <button
                type="button"
                onClick={() => setRevising(true)}
                className="text-[10px] uppercase tracking-[0.14em] font-sans px-3 py-1.5 rounded-md border border-border text-muted hover:text-fg hover:border-fg/40 transition-colors"
              >
                Revise
              </button>
            </div>
          )
        )}
      </div>
    </div>
  );
}

function PlanSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.14em] font-sans text-muted mb-1">{label}</p>
      {children}
    </div>
  );
}
