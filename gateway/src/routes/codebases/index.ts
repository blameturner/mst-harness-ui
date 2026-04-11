import { Hono } from 'hono';
import { requireAuth } from '../../middleware/requireAuth.js';
import type { AuthVariables } from '../../types/AuthVariables.js';
import { listCodebases } from './listCodebases.js';
import { createCodebase } from './createCodebase.js';
import { indexCodebase } from './indexCodebase.js';

export const codebasesRoute = new Hono<{ Variables: AuthVariables }>();

codebasesRoute.use('*', requireAuth);

codebasesRoute.get('/', listCodebases);
codebasesRoute.post('/', createCodebase);
codebasesRoute.post('/:id/index', indexCodebase);
