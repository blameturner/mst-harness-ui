import { sqlite } from './sqlite.js';

export async function getOrgIdForUser(userId: string): Promise<number | null> {
  const row = sqlite.prepare('SELECT "orgId" as orgId FROM user WHERE id = ?').get(userId) as
    | { orgId: number | null }
    | undefined;
  return row?.orgId ?? null;
}
