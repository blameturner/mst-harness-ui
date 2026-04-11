import { Hono } from 'hono';
import { requireAuth } from '../../middleware/requireAuth.js';
import type { AuthVariables } from '../../types/AuthVariables.js';
import { listConversations } from './listConversations.js';
import { getConversationSummary } from './getConversationSummary.js';
import { patchConversation } from './patchConversation.js';
import { getConversationMessages } from './getConversationMessages.js';

export const conversationsRoute = new Hono<{ Variables: AuthVariables }>();

conversationsRoute.use('*', requireAuth);

conversationsRoute.get('/', listConversations);
conversationsRoute.get('/:id/summary', getConversationSummary);
conversationsRoute.patch('/:id', patchConversation);
conversationsRoute.get('/:id/messages', getConversationMessages);
