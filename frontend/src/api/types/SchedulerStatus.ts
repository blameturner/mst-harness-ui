import type { SchedulerLastRun } from './SchedulerLastRun';

export interface SchedulerStatus {
  running: boolean;
  next_run: string | null;
  sources_due: number;
  last_run: SchedulerLastRun | null;
}
