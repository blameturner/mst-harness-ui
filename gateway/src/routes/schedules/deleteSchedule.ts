import type { Context } from 'hono';
import { getAuthContext } from '../../lib/auth-context.js';
import { parseIdParam } from '../../lib/parseIdParam.js';
import { patchRow } from '../../services/nocodb/index.js';
import { tryReload } from './tryReload.js';
import { loadOwnedSchedule } from './loadOwnedSchedule.js';

export async function deleteSchedule(c: Context) {
  const { orgId } = getAuthContext(c);
  try {
    const id = parseIdParam(c.req.param('id'), 'schedule_id');
    if (id == null) return c.json({ error: 'invalid_id' }, 400);
    const existing = await loadOwnedSchedule(orgId, id);
    if (!existing) return c.json({ error: 'not_found' }, 404);
    // Soft delete by deactivation — the harness only registers active rows,
    // so the next /scheduler/reload drops the job.
    await patchRow('agent_schedules', existing.Id, { active: false });
    const warning = await tryReload();
    return c.json({ ok: true, reload_warning: warning ?? undefined });
  } catch (err) {
    console.error('[schedules] delete failed', err);
    return c.json({ error: 'nocodb_error' }, 502);
  }
}
