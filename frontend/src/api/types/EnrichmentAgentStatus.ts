import type { SchedulerLastRun } from './SchedulerLastRun';

export interface EnrichmentAgentStatus {
  next_run: string | null;
  last_run: SchedulerLastRun | null;
  sources_due: number;
}
