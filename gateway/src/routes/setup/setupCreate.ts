import type { Context } from 'hono';
import { auth } from '../../auth/auth.js';
import { countActive, createRow, deleteRow, listWhere } from '../../services/nocodb/index.js';
import { escapeNocoFilter } from '../../lib/escapeNocoFilter.js';
import { setupSchema } from './schemas/setupSchema.js';
import { withSetupLock } from './withSetupLock.js';

export async function setupCreate(c: Context) {
  const body = await c.req.json().catch(() => null);
  const parsed = setupSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'invalid_body', issues: parsed.error.issues }, 400);

  return withSetupLock(async () => {
    const existing = await countActive('organisation');
    if (existing > 0) return c.json({ error: 'already_configured' }, 409);

    const { orgName, slug, email, password, displayName } = parsed.data;

    // Compensating-rollback pattern: NocoDB has no transactions, so we track
    // what we created and delete it on any downstream failure. Leaving the
    // system half-configured would wedge /api/setup permanently.
    let orgId: number | null = null;
    let userRowId: number | string | null = null;

    try {
      const org = await createRow<{ Id: number }>('organisation', {
        name: orgName,
        slug,
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
          await deleteRow('organisation', orgId);
        } catch (rbErr) {
          console.error('[setup] rollback org delete failed', rbErr);
        }
      }
      return c.json({ error: 'setup_failed' }, 500);
    }
  });
}
