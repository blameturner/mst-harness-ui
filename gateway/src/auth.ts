import { betterAuth, type BetterAuthOptions } from 'better-auth';
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { env } from './env.js';
import { countActive, createRow, listWhere } from './services/nocodb/index.js';
import { escapeNocoFilter, isValidEmail } from './lib/noco-filter.js';

// Resolve file:... DATABASE_URL to a path and ensure its directory exists.
const dbPath = env.DATABASE_URL.replace(/^file:/, '');
mkdirSync(dirname(dbPath), { recursive: true });

const sqlite = new Database(dbPath);

type OrgRow = { Id: number; name: string; slug: string };
type UserRow = { Id: number; org_id: number; email: string };

/**
 * Used by the Better-Auth user.create.after hook for signups that happen AFTER
 * first-run setup (i.e. additional users invited into the existing org).
 * First-run setup is driven explicitly by POST /api/setup which passes
 * `skipOrgHook=true` in the user metadata so this does not double-create.
 */
async function attachToExistingOrg(email: string, displayName?: string): Promise<number> {
  if (!isValidEmail(email)) {
    throw new Error('Invalid email');
  }
  const orgs = await listWhere<OrgRow>('organisations', '', 1);
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

export const authOptions: BetterAuthOptions = {
  database: sqlite,
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.GATEWAY_URL,
  emailAndPassword: {
    enabled: true,
    autoSignIn: false,
    minPasswordLength: 8,
  },
  trustedOrigins: [env.FRONTEND_ORIGIN],
  // Cookie attributes depend on transport. On HTTPS we require Secure and allow
  // cross-site (sameSite=none). On plain HTTP (localhost dev or acknowledged
  // ALLOW_INSECURE_LAN deployments) browsers reject Secure cookies, so we fall
  // back to sameSite=lax without Secure. SameSite=lax still provides CSRF
  // protection for state-changing requests from unrelated origins.
  advanced: {
    defaultCookieAttributes: (() => {
      const isHttps =
        env.GATEWAY_URL.startsWith('https://') && env.FRONTEND_ORIGIN.startsWith('https://');
      return {
        sameSite: isHttps ? 'none' : 'lax',
        secure: isHttps,
        httpOnly: true,
      };
    })(),
  },
  user: {
    additionalFields: {
      orgId: { type: 'number', required: false, input: false },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          // First-run setup path uses auth.api.signUpEmail with a marker we can check via
          // an existing org count: if zero orgs exist, allow signup (setup route pre-created it).
          if (!env.ALLOW_REGISTRATION) {
            const count = await countActive('organisations');
            if (count > 0) {
              throw new Error('registration_disabled');
            }
          }
          return { data: user };
        },
        after: async (user) => {
          try {
            if (!user?.id) {
              throw new Error('user.id missing in create.after hook');
            }
            // If an org already exists, link to it. If we're in first-run setup, the setup
            // route has already created the org + users row, so this attach is idempotent.
            const orgId = await attachToExistingOrg(user.email, (user as any).name);
            const result = sqlite
              .prepare('UPDATE user SET "orgId" = ? WHERE id = ?')
              .run(orgId, user.id);
            if (result.changes === 0) {
              throw new Error(`Failed to set orgId on user ${user.id}: no rows updated`);
            }
          } catch (err) {
            console.error('[auth] attachToExistingOrg failed', err);
            throw err;
          }
        },
      },
    },
  },
};

export const auth = betterAuth(authOptions);

export async function getOrgIdForUser(userId: string): Promise<number | null> {
  const row = sqlite.prepare('SELECT "orgId" as orgId FROM user WHERE id = ?').get(userId) as
    | { orgId: number | null }
    | undefined;
  return row?.orgId ?? null;
}