import { Hono } from 'hono';
import { requireAuth } from '../../middleware/requireAuth.js';
import type { AuthVariables } from '../../types/AuthVariables.js';
import { listContainers } from './listContainers.js';
import { streamLogs } from './streamLogs.js';

export const logsRoute = new Hono<{ Variables: AuthVariables }>();

logsRoute.use('*', requireAuth);

logsRoute.get('/containers', listContainers);
logsRoute.get('/stream', streamLogs);
