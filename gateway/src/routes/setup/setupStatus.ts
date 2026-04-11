import type { Context } from 'hono';
import { countAuthUsers } from '../../auth/countAuthUsers.js';
import { countActive } from '../../services/nocodb/index.js';

export async function setupStatus(c: Context) {
  // Configured means: at least one Better Auth user exists. A NocoDB org row
  // alone is not enough (it may have been pre-seeded manually). This is what
  // the frontend uses to decide whether /setup or /login is the landing page.
  try {
    const authUsers = countAuthUsers();
    if (authUsers > 0) return c.json({ configured: true });
    // No auth user yet — but check the org table anyway so the status endpoint
    // can still report on NocoDB health. If NocoDB is down this will throw.
    await countActive('organisation');
    return c.json({ configured: false });
  } catch (err) {
    console.error('[setup/status]', err);
    return c.json({ configured: false }, 503);
  }
}
