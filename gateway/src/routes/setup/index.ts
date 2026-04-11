import { Hono } from 'hono';
import { setupStatus } from './setupStatus.js';
import { setupCreate } from './setupCreate.js';

export const setupRoute = new Hono();

setupRoute.get('/status', setupStatus);
setupRoute.post('/', setupCreate);
