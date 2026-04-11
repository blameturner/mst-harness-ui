import type { ScheduleRow } from './types/ScheduleRow.js';

function toBool(v: unknown): boolean {
  return v === true || v === 1 || v === '1' || v === 'true';
}

export function normaliseSchedule(row: ScheduleRow) {
  return {
    id: row.Id,
    org_id: row.org_id,
    agent_name: row.agent_name,
    cron_expression: row.cron_expression,
    timezone: row.timezone,
    task_description: row.task_description,
    product: row.product,
    active: toBool(row.active),
  };
}
