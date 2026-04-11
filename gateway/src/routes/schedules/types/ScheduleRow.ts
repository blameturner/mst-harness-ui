export type ScheduleRow = {
  Id: number;
  org_id: number;
  agent_name: string;
  cron_expression: string;
  timezone: string;
  task_description: string;
  product: string;
  active: boolean | number | null;
};
