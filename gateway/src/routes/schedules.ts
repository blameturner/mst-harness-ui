import { Hono } from 'hono';
import { z } from 'zod';
import { requireAuth } from '../middleware/requireAuth.js';
import { getAuthContext } from '../lib/auth-context.js';
import { FetchTimeoutError } from '../lib/fetch-with-timeout.js';
import { parseIdParam } from '../lib/parseIdParam.js';
import {
  createRow,
  listWhere,
  patchRow,
} from '../services/nocodb/index.js';
import { reloadScheduler } from '../services/harness/index.js';
import type { AuthVariables } from '../types/auth.js';

export const schedulesRoute = new Hono<{ Variables: AuthVariables }>();

schedulesRoute.use('*', requireAuth);

type ScheduleRow = {
  Id: number;
  org_id: number;
  agent_name: string;
  cron_expression: string;
  timezone: string;
  task_description: string;
  product: string;
  active: boolean | number | null;
};

/**
 * Validate a 5-field POSIX cron expression. We deliberately reject both the
 * 6-field (seconds) form and the @hourly / @daily aliases because
 * `CronTrigger.from_crontab` in the harness only understands classic 5-field.
 * Returning early with a clear error is better than an opaque harness 500.
 */
function isValidCron(expr: string): boolean {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  const fieldPattern = /^(\*|[\d,\-/*]+)$/;
  return parts.every((p) => fieldPattern.test(p));
}

/**
 * IANA timezone check via Intl. Anything that ICU doesn't recognise (e.g.
 * "AEST", "AEDT", "GMT+10") throws — we catch and reject. This matches the
 * harness, which resolves timezones through pytz/zoneinfo.
 */
function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const scheduleSchema = z.object({
  agent_name: z.string().min(1),
  cron_expression: z
    .string()
    .refine(isValidCron, 'cron_expression must be standard 5-field cron (no seconds, no aliases)'),
  timezone: z
    .string()
    .default('Australia/Sydney')
    .refine(isValidTimezone, 'timezone must be a valid IANA identifier (e.g. Australia/Sydney)'),
  task_description: z.string().min(1),
  product: z.string().default(''),
  active: z.boolean().default(true),
});

const updateScheduleSchema = scheduleSchema.partial();

function toBool(v: unknown): boolean {
  return v === true || v === 1 || v === '1' || v === 'true';
}

function normalise(row: ScheduleRow) {
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

async function tryReload(): Promise<string | null> {
  try {
    const res = await reloadScheduler();
    if (!res.ok) return `harness /scheduler/reload returned ${res.status}`;
    return null;
  } catch (err) {
    if (err instanceof FetchTimeoutError) return 'scheduler reload timed out';
    console.error('[schedules] reload failed', err);
    return 'scheduler reload unreachable';
  }
}

async function loadOwned(orgId: number, id: number): Promise<ScheduleRow | null> {
  const rows = await listWhere<ScheduleRow>(
    'agent_schedules',
    `(Id,eq,${id})~and(org_id,eq,${orgId})`,
    1,
  );
  return rows[0] ?? null;
}

schedulesRoute.get('/', async (c) => {
  const { orgId } = getAuthContext(c);
  try {
    const rows = await listWhere<ScheduleRow>(
      'agent_schedules',
      `(org_id,eq,${Number(orgId)})`,
      500,
    );
    return c.json({ schedules: rows.map(normalise) });
  } catch (err) {
    console.error('[schedules] list failed', err);
    return c.json({ error: 'nocodb_error' }, 502);
  }
});

schedulesRoute.post('/', async (c) => {
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
      { ...normalise(row), reload_warning: warning ?? undefined },
      201,
    );
  } catch (err) {
    console.error('[schedules] create failed', err);
    return c.json({ error: 'nocodb_error' }, 502);
  }
});

schedulesRoute.patch('/:id', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = updateScheduleSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid_body', issues: parsed.error.issues }, 400);
  }
  const { orgId } = getAuthContext(c);
  try {
    const id = parseIdParam(c.req.param('id'), 'schedule_id');
    if (id == null) return c.json({ error: 'invalid_id' }, 400);
    const existing = await loadOwned(orgId, id);
    if (!existing) return c.json({ error: 'not_found' }, 404);
    const updated = await patchRow<ScheduleRow>(
      'agent_schedules',
      existing.Id,
      parsed.data,
    );
    const warning = await tryReload();
    return c.json({ ...normalise(updated), reload_warning: warning ?? undefined });
  } catch (err) {
    console.error('[schedules] patch failed', err);
    return c.json({ error: 'nocodb_error' }, 502);
  }
});

schedulesRoute.delete('/:id', async (c) => {
  const { orgId } = getAuthContext(c);
  try {
    const id = parseIdParam(c.req.param('id'), 'schedule_id');
    if (id == null) return c.json({ error: 'invalid_id' }, 400);
    const existing = await loadOwned(orgId, id);
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
});
