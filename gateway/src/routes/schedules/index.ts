import { Hono } from 'hono';
import { requireAuth } from '../../middleware/requireAuth.js';
import type { AuthVariables } from '../../types/AuthVariables.js';
import { listSchedules } from './listSchedules.js';
import { createSchedule } from './createSchedule.js';
import { patchSchedule } from './patchSchedule.js';
import { deleteSchedule } from './deleteSchedule.js';

export const schedulesRoute = new Hono<{ Variables: AuthVariables }>();

schedulesRoute.use('*', requireAuth);

schedulesRoute.get('/', listSchedules);
schedulesRoute.post('/', createSchedule);
schedulesRoute.patch('/:id', patchSchedule);
schedulesRoute.delete('/:id', deleteSchedule);
