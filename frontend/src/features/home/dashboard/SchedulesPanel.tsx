import type { Schedule } from '../../../api/home/types';
import { runSchedule } from '../../../api/home/mutations';
import { useToast } from '../../../lib/toast/useToast';
import { formatRelative } from '../../../lib/utils/formatRelative';

interface Props {
  schedules: Schedule[];
}

export function SchedulesPanel({ schedules }: Props) {
  const toast = useToast();

  async function handleRun(s: Schedule) {
    try {
      await runSchedule({ id: s.id });
      toast.success(`${s.agent_name} dispatched`);
    } catch (err) {
      toast.error(`Run failed: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }

  const Header = (
    <div className="flex items-baseline gap-2 pb-1">
      <span className="text-[10px] uppercase tracking-[0.22em] font-sans text-muted">
        On the Diary
      </span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );

  if (schedules.length === 0) {
    return (
      <div>
        {Header}
        <div className="py-8 text-center">
          <p className="font-display italic text-muted">Nothing scheduled.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {Header}
      <ul className="divide-y divide-border">
        {schedules.map((s) => (
          <li
            key={s.id}
            className={[
              'group py-2.5 flex items-start gap-3',
              s.active ? '' : 'opacity-50',
            ].join(' ')}
          >
            <span
              className={[
                'mt-1 w-1.5 h-1.5 rounded-full shrink-0',
                s.active ? 'bg-fg' : 'bg-border',
              ].join(' ')}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <div className="truncate font-display text-[14px] text-fg">
                {s.agent_name}
              </div>
              <div className="truncate text-[11px] font-sans text-muted">
                <span className="font-mono tabular-nums">{s.cron_expression}</span>
                <span className="mx-1.5">·</span>
                <span>{s.timezone}</span>
              </div>
              <div className="text-[11px] text-muted mt-0.5">
                <span className="italic font-display">next</span>{' '}
                <span>{formatRelative(s.next_run_time)}</span>
              </div>
            </div>
            <button
              className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] uppercase tracking-[0.16em] font-sans text-muted hover:text-fg shrink-0 mt-1"
              onClick={() => void handleRun(s)}
            >
              Run ›
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
