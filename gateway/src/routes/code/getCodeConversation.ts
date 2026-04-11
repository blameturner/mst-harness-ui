import type { Context } from 'hono';
import { getAuthContext } from '../../lib/auth-context.js';
import { mapHarnessError } from '../../lib/mapHarnessError.js';
import { assertInteger } from '../../lib/assertInteger.js';
import { findOwnedCodeConversation } from './findOwnedCodeConversation.js';

export async function getCodeConversation(c: Context) {
  const { orgId } = getAuthContext(c);
  let conversationId: number;
  try {
    conversationId = assertInteger(c.req.param('id'), 'conversation_id');
  } catch {
    return c.json({ error: 'invalid_id' }, 400);
  }
  try {
    const owned = await findOwnedCodeConversation(conversationId, Number(orgId));
    if (!owned.ok) return owned.response;
    return c.json({ conversation: owned.conversation });
  } catch (err) {
    return mapHarnessError(err, 'code');
  }
}
