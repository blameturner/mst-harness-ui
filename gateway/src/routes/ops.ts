import { Hono } from 'hono';
import { requireAuth } from '../middleware/requireAuth.js';
import { mapHarnessError } from '../lib/mapHarnessError.js';
import { forwardResponse } from '../lib/forwardResponse.js';
import type { AuthVariables } from '../types/AuthVariables.js';
import { harnessClient } from '../services/harness/client.js';

const TIMEOUT = 20_000;

export const opsRoute = new Hono<{ Variables: AuthVariables }>();

opsRoute.use('*', requireAuth);

opsRoute.get('/dashboard', async (c) => {
  const qs = c.req.url.includes('?') ? `?${c.req.url.split('?')[1]}` : '';
  try {
    const res = await harnessClient.get(`/ops/dashboard${qs}`, TIMEOUT);
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'ops');
  }
});

