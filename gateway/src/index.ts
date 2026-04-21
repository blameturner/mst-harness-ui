import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { getMigrations } from 'better-auth/db/migration';
import { env } from './env.js';
import { auth } from './auth/auth.js';
import { authOptions } from './auth/authOptions.js';
import { initNocodbTables } from './services/nocodb/index.js';
import type { AuthVariables } from './types/AuthVariables.js';
import { setupRoute } from './routes/setup/index.js';
import { modelsRoute } from './routes/models.js';
import { stylesRoute } from './routes/styles.js';
import { workersRoute } from './routes/workers.js';
import { runRoute } from './routes/run.js';
import { chatRoute } from './routes/chat.js';
import { codeRoute } from './routes/code/index.js';
import { conversationsRoute } from './routes/conversations/index.js';
import { agentsRoute } from './routes/agents/index.js';
import { schedulesRoute } from './routes/schedules/index.js';
import { orgRoute } from './routes/org.js';
import { healthRoute } from './routes/health.js';
import { streamRoute } from './routes/stream.js';
import { codebasesRoute } from './routes/codebases/index.js';
import { logsRoute } from './routes/logs/index.js';
import { harnessRoute } from './routes/harness.js';
import { queueRoute } from './routes/queue.js';
import { enrichmentRoute } from './routes/enrichment.js';
import { collectionsRoute } from './routes/collections.js';
import { messagesRoute } from './routes/messages.js';
import { schedulerRoute } from './routes/scheduler.js';
import { opsRoute } from './routes/ops.js';
import { rateLimit } from './middleware/rateLimit.js';

const app = new Hono<{ Variables: AuthVariables }>();

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

// Rate limits. Tight buckets on auth and setup endpoints to deter brute force
// and setup-spam; a looser bucket on the rest of the API as a safety net.
// In-memory limiter is appropriate for the single-instance LAN deployment.
app.use(
  '/api/auth/*',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 20, name: 'auth' }),
);
app.use('/api/setup/*', rateLimit({ windowMs: 60 * 60 * 1000, max: 10, name: 'setup' }));
app.use('/api/setup', rateLimit({ windowMs: 60 * 60 * 1000, max: 10, name: 'setup' }));
app.use('/api/*', rateLimit({ windowMs: 60 * 1000, max: 240, name: 'api' }));

app.on(['GET', 'POST'], '/api/auth/*', (c) => auth.handler(c.req.raw));

app.route('/api/setup', setupRoute);
app.route('/api/models', modelsRoute);
app.route('/api/styles', stylesRoute);
app.route('/api/workers', workersRoute);
app.route('/api/run', runRoute);
app.route('/api/chat', chatRoute);
app.route('/api/code', codeRoute);
app.route('/api/conversations', conversationsRoute);
app.route('/api/agents', agentsRoute);
app.route('/api/schedules', schedulesRoute);
app.route('/api/org', orgRoute);
app.route('/api/health', healthRoute);
app.route('/api/stream', streamRoute);
app.route('/api/codebases', codebasesRoute);
app.route('/api/logs', logsRoute);
app.route('/api/harness', harnessRoute);
app.route('/api/queue', queueRoute);
app.route('/api/tool-queue', queueRoute);
app.route('/api/enrichment', enrichmentRoute);
app.route('/api/collections', collectionsRoute);
app.route('/api/messages', messagesRoute);
app.route('/api/scheduler', schedulerRoute);
app.route('/api/ops', opsRoute);

app.get('/', (c) => c.json({ name: 'mst-ag-gateway', ok: true }));

async function main() {
  // Better Auth migrations create the `user` table and our `orgId` column. Idempotent on every boot.
  try {
    const { runMigrations } = await getMigrations(authOptions);
    await runMigrations();
    console.log('[boot] better-auth migrations applied');
  } catch (err) {
    console.error('[boot] better-auth migrations failed', err);
    process.exit(1);
  }

  // Nocodb table-id discovery has its own retry. If it still fails, crash so Docker restarts us.
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