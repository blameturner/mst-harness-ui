import { z } from 'zod';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/**
 * Ensure BETTER_AUTH_SECRET is set. If the operator did not provide one via env,
 * generate a 32-byte secret on first boot and persist it next to the SQLite DB
 * inside the mounted data volume (default: ./data/better-auth-secret). On every
 * subsequent boot the same file is read back, so sessions survive restarts.
 *
 * The secret is only auto-generated when DATABASE_URL points at a local file:
 * path — that's the contract of the persistent volume. For any other adapter
 * the operator must supply BETTER_AUTH_SECRET explicitly.
 */
function ensureAuthSecret(): void {
  if (process.env.BETTER_AUTH_SECRET && process.env.BETTER_AUTH_SECRET.length >= 16) {
    return;
  }

  const dbUrl = process.env.DATABASE_URL ?? 'file:./data/auth.db';
  if (!dbUrl.startsWith('file:')) {
    throw new Error(
      'BETTER_AUTH_SECRET is not set and DATABASE_URL is not a file: path — ' +
        'cannot auto-generate. Provide BETTER_AUTH_SECRET in the environment.',
    );
  }

  const dbPath = resolve(dbUrl.replace(/^file:/, ''));
  const secretPath = resolve(dirname(dbPath), 'better-auth-secret');

  if (existsSync(secretPath)) {
    const existing = readFileSync(secretPath, 'utf8').trim();
    if (existing.length >= 16) {
      process.env.BETTER_AUTH_SECRET = existing;
      console.log(`[env] loaded BETTER_AUTH_SECRET from ${secretPath}`);
      return;
    }
    console.warn(`[env] ${secretPath} exists but is too short — regenerating`);
  }

  mkdirSync(dirname(secretPath), { recursive: true });
  const generated = randomBytes(32).toString('base64url');
  writeFileSync(secretPath, generated + '\n', { flag: 'wx' });
  try {
    chmodSync(secretPath, 0o600);
  } catch {
    // non-POSIX filesystems may refuse chmod; the volume mount perms are the real guard
  }
  process.env.BETTER_AUTH_SECRET = generated;
  console.log(
    `[env] generated new BETTER_AUTH_SECRET and wrote ${secretPath} (first boot)`,
  );
}

ensureAuthSecret();

const schema = z.object({
  PORT: z.coerce.number().default(3900),
  HARNESS_URL: z.string().url().default('http://mst-ag-harness:3800'),
  NOCODB_URL: z.string().url(),
  NOCODB_TOKEN: z.string().min(1),
  NOCODB_BASE_ID: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(16),
  // Public, browser-reachable URL of this gateway. Used as Better Auth's baseURL
  // AND as the frontend's GATEWAY_URL — one value, both containers.
  GATEWAY_URL: z.string().url().default('http://localhost:3900'),
  DATABASE_URL: z.string().default('file:./data/auth.db'),
  ALLOW_REGISTRATION: z
    .string()
    .default('true')
    .transform((v) => v === 'true'),
  ENVIRONMENT: z.enum(['development', 'production']).default('production'),
  FRONTEND_ORIGIN: z.string().default('http://localhost:3000'),
});

export const env = schema.parse(process.env);
export type Env = typeof env;

// Fail-fast configuration checks. These guard against footguns on LAN deployments:
//   - A wildcard FRONTEND_ORIGIN combined with credentialed CORS is a CSRF hole.
//   - Production deployments exposed over plain HTTP leak session cookies.
if (env.FRONTEND_ORIGIN.includes('*')) {
  throw new Error(
    '[env] FRONTEND_ORIGIN must be an exact origin (credentialed CORS forbids wildcards).',
  );
}
if (env.ENVIRONMENT === 'production') {
  const httpGateway = env.GATEWAY_URL.startsWith('http://');
  const httpFrontend = env.FRONTEND_ORIGIN.startsWith('http://');
  if (httpGateway || httpFrontend) {
    const allowInsecure = process.env.ALLOW_INSECURE_LAN === 'true';
    const msg =
      '[env] production mode with plain HTTP URLs — session cookies are not protected in transit.';
    if (!allowInsecure) {
      throw new Error(
        `${msg} Set ALLOW_INSECURE_LAN=true to acknowledge a LAN-only deployment, or use HTTPS.`,
      );
    }
    console.warn(`${msg} ALLOW_INSECURE_LAN=true set — proceeding.`);
  }
}
