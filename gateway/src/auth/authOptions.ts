import type { BetterAuthOptions } from 'better-auth';
import { env } from '../env.js';
import { countActive } from '../services/nocodb/index.js';
import { sqlite } from './sqlite.js';
import { attachToExistingOrg } from './attachToExistingOrg.js';

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
            const count = await countActive('organisation');
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
