import type { PlannedSearchState } from '../../lib/plannedSearch/types';

interface Props {
  state: PlannedSearchState;
  onApprove: () => void;
  onReject: () => void;
}

const BUBBLE_MAX = 'max-w-[92%] md:max-w-[80%]';

export function PlannedSearchCard({ state, onApprove, onReject }: Props) {
  const { status, queries, errorMessage } = state;

  const isTerminal = status === 'completed' || status === 'rejected';
  const isWorking = status === 'submitting' || status === 'synthesising';

  return (
    <div className="flex justify-start animate-fadeIn">
      <div className={`${BUBBLE_MAX} bg-panel border border-border rounded-2xl rounded-bl-sm p-5 space-y-4`}>
        <header className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-[0.16em] font-sans text-muted">
            Proposed search
          </span>
          {status === 'synthesising' && (
            <span className="text-[10px] uppercase tracking-[0.14em] font-sans text-muted animate-pulse">
              · searching & synthesising…
            </span>
          )}
          {status === 'submitting' && (
            <span className="text-[10px] uppercase tracking-[0.14em] font-sans text-muted animate-pulse">
              · starting…
            </span>
          )}
          {status === 'completed' && (
            <span className="text-[10px] uppercase tracking-[0.14em] font-sans text-emerald-500">
              · searched
            </span>
          )}
          {status === 'rejected' && (
            <span className="text-[10px] uppercase tracking-[0.14em] font-sans text-muted">
              · declined
            </span>
          )}
        </header>

        <ul className="space-y-2.5">
          {queries.map((q, i) => (
            <li key={i} className="text-[15px] leading-relaxed">
              <span className="font-semibold text-fg">{q.query}</span>
              {q.reason && (
                <span className="block text-[12px] font-sans text-muted mt-0.5">
                  {q.reason}
                </span>
              )}
            </li>
          ))}
        </ul>

        {errorMessage && (
          <p className="text-[12px] font-sans text-red-600 bg-red-500/10 border border-red-600/30 rounded-md px-2.5 py-1.5">
            {errorMessage}
          </p>
        )}

        {!isTerminal && (
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={onApprove}
              disabled={isWorking}
              className="text-[11px] uppercase tracking-[0.14em] font-sans px-3 py-1.5 rounded-md bg-fg text-bg hover:bg-fg/85 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isWorking ? 'Working…' : 'Approve'}
            </button>
            <button
              type="button"
              onClick={onReject}
              disabled={isWorking}
              className="text-[11px] uppercase tracking-[0.14em] font-sans px-3 py-1.5 rounded-md border border-border text-fg hover:bg-panelHi transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Decline
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
