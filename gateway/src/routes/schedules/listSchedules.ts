import type { Context } from 'hono';
import { getAuthContext } from '../../lib/auth-context.js';
import { listWhere } from '../../services/nocodb/index.js';
import { normaliseSchedule } from './normaliseSchedule.js';
import type { ScheduleRow } from './types/ScheduleRow.js';

export async function listSchedules(c: Context) {
  const { orgId } = getAuthContext(c);
  try {
    const rows = await listWhere<ScheduleRow>(
      'agent_schedules',
      `(org_id,eq,${Number(orgId)})`,
      500,
    );
    return c.json({ schedules: rows.map(normaliseSchedule) });
  } catch (err) {
    console.error('[schedules] list failed', err);
    return c.json({ error: 'nocodb_error' }, 502);
  }
}
