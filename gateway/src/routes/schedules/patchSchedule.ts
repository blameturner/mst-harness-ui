import type { Context } from 'hono';
import { getAuthContext } from '../../lib/auth-context.js';
import { parseIdParam } from '../../lib/parseIdParam.js';
import { patchRow } from '../../services/nocodb/index.js';
import { updateScheduleSchema } from './schemas/updateScheduleSchema.js';
import { normaliseSchedule } from './normaliseSchedule.js';
import { tryReload } from './tryReload.js';
import { loadOwnedSchedule } from './loadOwnedSchedule.js';
import type { ScheduleRow } from './types/ScheduleRow.js';

export async function patchSchedule(c: Context) {
  const body = await c.req.json().catch(() => null);
  const parsed = updateScheduleSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid_body', issues: parsed.error.issues }, 400);
  }
  const { orgId } = getAuthContext(c);
  try {
    const id = parseIdParam(c.req.param('id'), 'schedule_id');
    if (id == null) return c.json({ error: 'invalid_id' }, 400);
    const existing = await loadOwnedSchedule(orgId, id);
    if (!existing) return c.json({ error: 'not_found' }, 404);
    const updated = await patchRow<ScheduleRow>(
      'agent_schedules',
      existing.Id,
      parsed.data,
    );
    const warning = await tryReload();
    return c.json({ ...normaliseSchedule(updated), reload_warning: warning ?? undefined });
  } catch (err) {
    console.error('[schedules] patch failed', err);
    return c.json({ error: 'nocodb_error' }, 502);
  }
}
