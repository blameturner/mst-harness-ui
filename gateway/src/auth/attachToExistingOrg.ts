import { createRow, listWhere } from '../services/nocodb/index.js';
import { escapeNocoFilter } from '../lib/escapeNocoFilter.js';
import { isValidEmail } from '../lib/isValidEmail.js';
import type { OrgRow } from './types/OrgRow.js';
import type { UserRow } from './types/UserRow.js';

// Used by the Better-Auth user.create.after hook for signups that happen AFTER
// first-run setup (i.e. additional users invited into the existing org).
// First-run setup is driven explicitly by POST /api/setup which passes
// `skipOrgHook=true` in the user metadata so this does not double-create.
export async function attachToExistingOrg(email: string, displayName?: string): Promise<number> {
  if (!isValidEmail(email)) {
    throw new Error('Invalid email');
  }
  const orgs = await listWhere<OrgRow>('organisation', '', 1);
  if (orgs.length === 0) {
    throw new Error('No organisation exists — run /api/setup first');
  }
  const orgId = orgs[0].Id;
  const existing = await listWhere<UserRow>(
    'users',
    `(email,eq,${escapeNocoFilter(email)})`,
    1,
  );
  if (existing.length === 0) {
    await createRow<UserRow>('users', {
      org_id: orgId,
      email,
      display_name: displayName ?? email,
      role: 'member',
      last_active_at: new Date().toISOString(),
    });
  }
  return orgId;
}
