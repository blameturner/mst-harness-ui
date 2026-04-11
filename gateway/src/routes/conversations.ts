import { Hono } from 'hono';
import { requireAuth } from '../middleware/requireAuth.js';
import { getAuthContext } from '../lib/auth-context.js';
import { mapHarnessError } from '../lib/mapHarnessError.js';
import { forwardResponse } from '../lib/forwardResponse.js';
import { z } from 'zod';
import {
  getConversationMessages as harnessGetMessages,
  getConversationSummary as harnessGetSummary,
  listConversations as harnessListConversations,
  updateConversation as harnessUpdateConversation,
} from '../services/harness/index.js';
import { assertInteger } from '../lib/noco-filter.js';
import type { AuthVariables } from '../types/auth.js';

export const conversationsRoute = new Hono<{ Variables: AuthVariables }>();

conversationsRoute.use('*', requireAuth);

/** List this org's conversations (most recent first). */
conversationsRoute.get('/', async (c) => {
  const { orgId } = getAuthContext(c);
  try {
    const res = await harnessListConversations(Number(orgId));
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'conversations');
  }
});

/**
 * Fetch full history for one conversation. We check that the conversation
 * belongs to the caller's org before returning — org_id is enforced server-side,
 * never trusted from the client.
 */
/**
 * Rich stats for a conversation. Same org-ownership check as /messages —
 * we fetch the conversation first (indirectly, via the summary response)
 * and reject if org_id doesn't match the caller's session.
 */
conversationsRoute.get('/:id/summary', async (c) => {
  const { orgId } = getAuthContext(c);
  let conversationId: number;
  try {
    conversationId = assertInteger(c.req.param('id'), 'conversation_id');
  } catch {
    return c.json({ error: 'invalid_id' }, 400);
  }
  try {
    const res = await harnessGetSummary(conversationId);
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
});

/**
 * Rename (or otherwise patch) a conversation. We enforce org ownership by
 * fetching the existing conversation first via the summary endpoint — the
 * harness's PATCH /conversations/{id} does not otherwise know who's calling.
 */
const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
});

conversationsRoute.patch('/:id', async (c) => {
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
});

conversationsRoute.get('/:id/messages', async (c) => {
  const { orgId } = getAuthContext(c);
  let conversationId: number;
  try {
    conversationId = assertInteger(c.req.param('id'), 'conversation_id');
  } catch {
    return c.json({ error: 'invalid_id' }, 400);
  }

  try {
    const res = await harnessGetMessages(conversationId);
    if (!res.ok) return forwardResponse(res);
    const body = (await res.json()) as {
      conversation?: { org_id?: number } | null;
      messages?: unknown[];
    };
    if (!body.conversation || Number(body.conversation.org_id) !== Number(orgId)) {
      return c.json({ error: 'not_found' }, 404);
    }
    return c.json(body);
  } catch (err) {
    return mapHarnessError(err, 'conversations');
  }
});
