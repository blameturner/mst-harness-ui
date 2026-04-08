import { Hono } from 'hono';
import { listModels } from '../services/harness/index.js';

export const modelsRoute = new Hono();

modelsRoute.get('/', async (c) => {
  try {
    const res = await listModels();
    if (!res.ok) return c.json({ error: 'harness_error', status: res.status }, 502);
    const body = await res.json();
    return c.json(body);
  } catch {
    return c.json({ error: 'harness_unreachable' }, 502);
  }
});
