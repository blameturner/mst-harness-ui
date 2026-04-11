import type { Context } from 'hono';
import { getAuthContext } from '../../lib/auth-context.js';
import { mapHarnessError } from '../../lib/mapHarnessError.js';
import { forwardResponse } from '../../lib/forwardResponse.js';
import { assertInteger } from '../../lib/assertInteger.js';
import { updateCodeConversation } from '../../services/harness/index.js';
import { findOwnedCodeConversation } from './findOwnedCodeConversation.js';
import { patchCodeSchema } from './schemas/patchCodeSchema.js';

export async function patchCodeConversation(c: Context) {
  const { orgId } = getAuthContext(c);
  let conversationId: number;
  try {
    conversationId = assertInteger(c.req.param('id'), 'conversation_id');
  } catch {
    return c.json({ error: 'invalid_id' }, 400);
  }
  const body = await c.req.json().catch(() => null);
  const parsed = patchCodeSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid_body', issues: parsed.error.issues }, 400);
  }
  try {
    const owned = await findOwnedCodeConversation(conversationId, Number(orgId));
    if (!owned.ok) return owned.response;
    const res = await updateCodeConversation(conversationId, parsed.data);
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'code');
  }
}
