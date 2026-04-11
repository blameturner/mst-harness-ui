import { listWhere } from '../../services/nocodb/index.js';
import type { ScheduleRow } from './types/ScheduleRow.js';

export async function loadOwnedSchedule(orgId: number, id: number): Promise<ScheduleRow | null> {
  const rows = await listWhere<ScheduleRow>(
    'agent_schedules',
    `(Id,eq,${id})~and(org_id,eq,${orgId})`,
    1,
  );
  return rows[0] ?? null;
}
