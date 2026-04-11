import type { Context } from 'hono';
import { getAuthContext } from '../../lib/auth-context.js';
import { mapHarnessError } from '../../lib/mapHarnessError.js';
import { forwardResponse } from '../../lib/forwardResponse.js';
import { assertInteger } from '../../lib/assertInteger.js';
import {
  getConversationSummary as harnessGetSummary,
  updateConversation as harnessUpdateConversation,
} from '../../services/harness/index.js';
import { patchSchema } from './schemas/patchSchema.js';

export async function patchConversation(c: Context) {
  const { orgId } = getAuthContext(c);
  let conversationId: number;
  try {
    conversationId = assertInteger(c.req.param('id'), 'conversation_id');
  } catch {
    return c.json({ error: 'invalid_id' }, 400);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'invalid_body', issues: parsed.error.issues }, 400);
  }

  try {
    // Ownership check: fetch the existing conversation and verify org_id.
    const existingRes = await harnessGetSummary(conversationId);
    if (!existingRes.ok) return forwardResponse(existingRes);
    const existing = (await existingRes.json()) as {
      conversation?: { org_id?: number } | null;
    };
    if (!existing.conversation || Number(existing.conversation.org_id) !== Number(orgId)) {
      return c.json({ error: 'not_found' }, 404);
    }

    const res = await harnessUpdateConversation(conversationId, parsed.data);
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'conversations');
  }
}
