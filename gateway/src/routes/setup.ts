import { Hono } from 'hono';
import { z } from 'zod';
import { auth } from '../auth.js';
import { countActive, createRow, deleteRow, listWhere } from '../services/nocodb/index.js';
import { escapeNocoFilter } from '../lib/noco-filter.js';

export const setupRoute = new Hono();

// Serialise concurrent POST /api/setup calls with a process-local promise chain.
// The underlying check-then-create is a TOCTOU, and NocoDB does not expose
// transactions, so we resolve the race inside the gateway. Single-instance
// deployment is part of the contract for LAN use.
let setupLock: Promise<unknown> = Promise.resolve();
function withSetupLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = setupLock.then(fn, fn);
  setupLock = next.catch(() => undefined);
  return next;
}

setupRoute.get('/status', async (c) => {
  try {
    const count = await countActive('organisations');
    return c.json({ configured: count > 0 });
  } catch (err) {
    console.error('[setup/status]', err);
    // Intentionally generic — do not reveal NocoDB reachability to unauth callers.
    return c.json({ configured: false }, 503);
  }
});

const setupSchema = z.object({
  orgName: z.string().min(1),
  slug: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1),
});

setupRoute.post('/', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = setupSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'invalid_body', issues: parsed.error.issues }, 400);

  return withSetupLock(async () => {
    const existing = await countActive('organisations');
    if (existing > 0) return c.json({ error: 'already_configured' }, 409);

    const { orgName, slug, email, password, displayName } = parsed.data;

    // Compensating-rollback pattern: NocoDB has no transactions, so we track
    // what we created and delete it on any downstream failure. Leaving the
    // system half-configured would wedge /api/setup permanently.
    let orgId: number | null = null;
    let userRowId: number | string | null = null;

    try {
      const org = await createRow<{ Id: number }>('organisations', {
        name: orgName,
        slug,
        plan: 'solo',
        settings: {},
      });
      orgId = org.Id;

      const userRow = await createRow<{ Id: number }>('users', {
        org_id: org.Id,
        email,
        display_name: displayName,
        role: 'owner',
        last_active_at: new Date().toISOString(),
      });
      userRowId = userRow?.Id ?? null;

      const signUp = await auth.api.signUpEmail({
        body: { email, password, name: displayName },
        headers: c.req.raw.headers,
      });
      return c.json({ success: true, user: signUp.user?.id ?? null });
    } catch (err) {
      console.error('[setup] failed, rolling back', err);
      // Best-effort compensating deletes. Order: users row, then org.
      if (userRowId != null) {
        try {
          await deleteRow('users', userRowId);
        } catch (rbErr) {
          console.error('[setup] rollback users delete failed', rbErr);
        }
      } else if (orgId != null) {
        // If we never captured the user Id but the row may exist, try to find it.
        try {
          const rows = await listWhere<{ Id: number }>(
            'users',
            `(email,eq,${escapeNocoFilter(parsed.data.email)})`,
            1,
          );
          if (rows[0]?.Id != null) await deleteRow('users', rows[0].Id);
        } catch (rbErr) {
          console.error('[setup] rollback users lookup failed', rbErr);
        }
      }
      if (orgId != null) {
        try {
          await deleteRow('organisations', orgId);
        } catch (rbErr) {
          console.error('[setup] rollback org delete failed', rbErr);
        }
      }
      return c.json({ error: 'setup_failed' }, 500);
    }
  });
});
