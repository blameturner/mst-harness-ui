import type { SchedulerStatus } from '../../api/types/SchedulerStatus';
import { relTime } from '../../lib/utils/relTime';

export function StatusBadge({ status }: { status: SchedulerStatus | null }) {
  if (!status) {
    return (
      <span className="text-[10px] uppercase tracking-[0.18em] font-sans text-muted">
        scheduler: unknown
      </span>
    );
  }
  return (
    <span className="text-[10px] uppercase tracking-[0.18em] font-sans text-muted">
      <span className={status.running ? 'text-fg' : 'text-muted'}>
        {status.running ? '● running' : '○ idle'}
      </span>
      {' · '}
      {status.sources_due} due
      {status.next_run && ` · next ${relTime(status.next_run)}`}
      {status.last_run && ` · last ${relTime(status.last_run.finished_at)}`}
    </span>
  );
}
