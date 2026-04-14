import type { GapReport } from '../../../../api/types/Enrichment';
import { ConfidenceMeter } from './ConfidenceMeter';

interface Props {
  report: GapReport;
  threshold?: number;
  onRerun?: () => void;
  onComplete?: () => void;
  busy?: boolean;
}

export function GapReportPanel({ report, threshold, onRerun, onComplete, busy }: Props) {
  const gapCount = report.gaps_found?.length ?? 0;
  const reqCount = report.new_search_requirements?.length ?? 0;

  return (
    <div className="rounded border border-border bg-bg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-[11px] uppercase tracking-[0.14em] text-muted">Gap Report</h4>
        {report.ready_for_completion && (
          <span className="px-2 py-0.5 rounded text-[10px] uppercase tracking-[0.1em] bg-emerald-500/15 text-emerald-700">
            Ready
          </span>
        )}
      </div>

      <ConfidenceMeter score={report.confidence_score ?? 0} threshold={threshold} />

      {gapCount > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] text-muted mb-2">Gaps Found ({gapCount})</p>
          <ul className="space-y-1.5">
            {report.gaps_found.map((g, i) => (
              <li key={i} className="text-xs flex items-baseline gap-2">
                <span className="font-mono text-fg">{g.field}</span>
                <span className="text-muted">·</span>
                <span className="text-amber-700">{g.status}</span>
                {g.needed && <span className="text-muted truncate">— {g.needed}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {reqCount > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] text-muted mb-2">New Search Requirements</p>
          <ul className="space-y-1">
            {report.new_search_requirements.map((q, i) => (
              <li key={i} className="text-xs text-fg">• {q}</li>
            ))}
          </ul>
        </div>
      )}

      {report.notes && (
        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] text-muted mb-1">Notes</p>
          <p className="text-xs text-fg/80 italic">{report.notes}</p>
        </div>
      )}

      {(onRerun || onComplete) && (
        <div className="flex gap-2 pt-2 border-t border-border">
          {onRerun && (
            <button
              onClick={onRerun}
              disabled={busy}
              className="px-3 py-1.5 rounded border border-border text-[10px] uppercase tracking-[0.14em] hover:bg-panel disabled:opacity-50"
            >
              Re-run Agent
            </button>
          )}
          {onComplete && (
            <button
              onClick={onComplete}
              disabled={busy}
              className="px-3 py-1.5 rounded bg-fg text-bg text-[10px] uppercase tracking-[0.14em] hover:bg-fg/90 disabled:opacity-50"
            >
              Mark Complete
            </button>
          )}
        </div>
      )}
    </div>
  );
}
