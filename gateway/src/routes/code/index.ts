import { Hono } from 'hono';
import { requireAuth } from '../../middleware/requireAuth.js';
import type { AuthVariables } from '../../types/AuthVariables.js';
import { listCodeConversations } from './listCodeConversations.js';
import { getCodeConversation } from './getCodeConversation.js';
import { getCodeMessages } from './getCodeMessages.js';
import { getCodeWorkspace } from './getCodeWorkspace.js';
import { patchCodeConversation } from './patchCodeConversation.js';
import { postCode } from './postCode.js';

export const codeRoute = new Hono<{ Variables: AuthVariables }>();

codeRoute.use('*', requireAuth);

codeRoute.get('/conversations', listCodeConversations);
codeRoute.get('/conversations/:id', getCodeConversation);
codeRoute.get('/conversations/:id/messages', getCodeMessages);
codeRoute.get('/conversations/:id/workspace', getCodeWorkspace);
codeRoute.patch('/conversations/:id', patchCodeConversation);
codeRoute.post('/', postCode);
