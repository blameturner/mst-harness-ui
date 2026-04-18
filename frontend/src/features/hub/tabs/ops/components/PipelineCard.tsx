import type {
  PipelineKind,
  PipelineKindConfig,
  PipelineKindSchedule,
  PipelineLastJob,
} from '../../../../../api/types/PipelineSummary';
import { fmt } from '../lib/formatters';
import { RelativeTime } from './RelativeTime';
import { StatusChip } from './StatusChip';

const TITLE: Record<PipelineKind, string> = {
  scraper: 'Scraper',
  pathfinder: 'Pathfinder',
  discover_agent: 'Discover-agent',
};

export interface PipelineCardProps {
  kind: PipelineKind;
  config?: PipelineKindConfig;
  schedule?: PipelineKindSchedule;
  lastJob?: PipelineLastJob | null;
  disabled?: boolean;
  busy?: boolean;
  onKick: () => void;
}

export function PipelineCard({
  kind,
  config,
  schedule,
  lastJob,
  disabled,
  busy,
  onKick,
}: PipelineCardProps) {
  const cadence =
    config?.interval_minutes != null ? `every ${config.interval_minutes}m` : '—';
  const enabledLabel = config?.enabled === false ? 'disabled' : 'enabled';

  return (
    <div className="border border-border rounded p-3 space-y-2 min-w-[14rem]">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.16em] text-muted">{TITLE[kind]}</p>
        <span className="text-[10px] uppercase tracking-[0.14em] text-muted">{enabledLabel}</span>
      </div>

      <div className="text-sm">
        <p className="text-muted text-[11px] uppercase tracking-[0.14em]">Cadence</p>
        <p className="text-fg">{cadence}</p>
      </div>

      <div className="text-sm">
        <p className="text-muted text-[11px] uppercase tracking-[0.14em]">Next run</p>
        <p className="text-fg">
          <RelativeTime iso={schedule?.next_run} showAbsolute />
        </p>
        {schedule?.cooldown_until && (
          <p className="text-amber-300 text-[11px]">
            cooldown until <RelativeTime iso={schedule.cooldown_until} />
          </p>
        )}
      </div>

      <div className="text-sm">
        <p className="text-muted text-[11px] uppercase tracking-[0.14em]">Last result</p>
        {lastJob ? (
          <div className="flex items-center gap-2 flex-wrap">
            <StatusChip status={lastJob.status ?? lastJob.result_status ?? 'unknown'} />
            <RelativeTime iso={lastJob.completed_at ?? lastJob.started_at} className="text-muted text-[11px]" />
            {lastJob.error && (
              <span className="text-red-400 text-[11px] truncate max-w-[10rem]" title={lastJob.error}>
                {fmt(lastJob.error)}
              </span>
            )}
          </div>
        ) : (
          <p className="text-muted">—</p>
        )}
      </div>

      <button
        type="button"
        onClick={onKick}
        disabled={disabled || busy}
        className="px-3 py-1.5 rounded border border-border text-[11px] uppercase tracking-[0.14em] hover:bg-panel disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {busy ? 'Kicking…' : 'Kick'}
      </button>
    </div>
  );
}
