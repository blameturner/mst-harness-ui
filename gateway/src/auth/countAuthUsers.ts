import { sqlite } from './sqlite.js';

// Number of Better Auth user rows in SQLite. Used by /api/setup/status so the
// frontend only treats the system as "configured" once an auth user actually
// exists (not merely when a NocoDB organisation row has been pre-seeded).
export function countAuthUsers(): number {
  const row = sqlite.prepare('SELECT COUNT(*) as c FROM user').get() as { c: number };
  return row?.c ?? 0;
}
