import { Hono } from 'hono';
import { health as harnessHealth } from '../services/harness/index.js';

export const healthRoute = new Hono();

healthRoute.get('/', async (c) => {
  let harness: 'ok' | 'error' = 'error';
  try {
    const res = await harnessHealth();
    if (res.ok) harness = 'ok';
  } catch {}
  return c.json({ status: 'ok', harness });
});
