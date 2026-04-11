import type { Context } from 'hono';
import { getAuthContext } from '../../lib/auth-context.js';
import { createRow } from '../../services/nocodb/index.js';
import { scheduleSchema } from './schemas/scheduleSchema.js';
import { normaliseSchedule } from './normaliseSchedule.js';
import { tryReload } from './tryReload.js';
import type { ScheduleRow } from './types/ScheduleRow.js';

export async function createSchedule(c: Context) {
  const body = await c.req.json().catch(() => null);
  const parsed = scheduleSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid_body', issues: parsed.error.issues }, 400);
  }
  const { orgId } = getAuthContext(c);
  try {
    const row = await createRow<ScheduleRow>('agent_schedules', {
      ...parsed.data,
      org_id: Number(orgId),
    });
    const warning = await tryReload();
    return c.json(
      { ...normaliseSchedule(row), reload_warning: warning ?? undefined },
      201,
    );
  } catch (err) {
    console.error('[schedules] create failed', err);
    return c.json({ error: 'nocodb_error' }, 502);
  }
}
