export interface ScheduleCreateBody {
  agent_name: string;
  cron_expression: string;
  timezone: string;
  task_description: string;
  product: string;
  active?: boolean;
}
