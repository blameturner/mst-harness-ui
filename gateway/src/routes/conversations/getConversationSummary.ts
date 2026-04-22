import type { Context } from 'hono';
import { getAuthContext } from '../../lib/auth-context.js';
import { mapHarnessError } from '../../lib/mapHarnessError.js';
import { forwardResponse } from '../../lib/forwardResponse.js';
import { assertInteger } from '../../lib/assertInteger.js';
import { getConversationSummary as harnessGetSummary } from '../../services/harness/index.js';

export async function getConversationSummary(c: Context) {
  const { orgId } = getAuthContext(c);
  let conversationId: number;
  try {
    conversationId = assertInteger(c.req.param('id'), 'conversation_id');
  } catch {
    return c.json({ error: 'invalid_id' }, 400);
  }
  try {
    const res = await harnessGetSummary(conversationId, Number(orgId));
    if (!res.ok) return forwardResponse(res);
    const body = (await res.json()) as {
      conversation?: { org_id?: number } | null;
    };
    if (!body.conversation || Number(body.conversation.org_id) !== Number(orgId)) {
      return c.json({ error: 'not_found' }, 404);
    }
    return c.json(body);
  } catch (err) {
    return mapHarnessError(err, 'conversations');
  }
}
