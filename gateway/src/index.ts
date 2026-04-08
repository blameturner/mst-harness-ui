import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { getMigrations } from 'better-auth/db/migration';
import { env } from './env.js';
import { auth, authOptions } from './auth.js';
import { initNocodbTables } from './nocodb.js';
import type { Variables } from './types.js';
import { setupRoute } from './routes/setup.js';
import { modelsRoute } from './routes/models.js';
import { workersRoute } from './routes/workers.js';
import { runRoute } from './routes/run.js';
import { orgRoute } from './routes/org.js';
import { healthRoute } from './routes/health.js';

const app = new Hono<{ Variables: Variables }>();

app.use('*', logger());
app.use(
  '*',
  cors({
    origin: env.FRONTEND_ORIGIN,
    credentials: true,
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  }),
);

// Better Auth handles all /api/auth/** routes.
app.on(['GET', 'POST'], '/api/auth/*', (c) => auth.handler(c.req.raw));

app.route('/api/setup', setupRoute);
app.route('/api/models', modelsRoute);
app.route('/api/workers', workersRoute);
app.route('/api/run', runRoute);
app.route('/api/org', orgRoute);
app.route('/api/health', healthRoute);

app.get('/', (c) => c.json({ name: 'mst-ag-gateway', ok: true }));

async function main() {
  // 1. Better Auth schema migrations — idempotent, safe on every boot.
  //    Without this, the `user` table (and our `orgId` column) does not exist.
  try {
    const { runMigrations } = await getMigrations(authOptions);
    await runMigrations();
    console.log('[boot] better-auth migrations applied');
  } catch (err) {
    console.error('[boot] better-auth migrations failed', err);
    process.exit(1);
  }

  // 2. Nocodb table ID discovery (with retry). If this fails, crash so Docker restarts us.
  try {
    await initNocodbTables();
  } catch (err) {
    console.error('[boot] Nocodb table discovery failed — aborting', err);
    process.exit(1);
  }

  serve({ fetch: app.fetch, port: env.PORT }, (info) => {
    console.log(`[gateway] listening on :${info.port}`);
  });
}

main();