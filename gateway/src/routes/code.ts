import { Hono } from 'hono';
import { z } from 'zod';
import { requireAuth } from '../middleware/requireAuth.js';
import { getAuthContext } from '../lib/auth-context.js';
import { FetchTimeoutError } from '../lib/fetch-with-timeout.js';
import {
  code as harnessCode,
  listCodeConversations,
  getCodeConversation,
  getCodeConversationMessages,
  getCodeWorkspace,
  updateCodeConversation,
} from '../services/harness/index.js';
import { assertInteger } from '../lib/noco-filter.js';
import type { AuthVariables } from '../types/auth.js';

export const codeRoute = new Hono<{ Variables: AuthVariables }>();

codeRoute.use('*', requireAuth);

const fileSchema = z.object({
  name: z.string().min(1),
  content_b64: z.string(),
});

const codeSchema = z.object({
  model: z.string().min(1),
  message: z.string().min(1),
  mode: z.enum(['plan', 'execute', 'debug']),
  approved_plan: z.string().optional().nullable(),
  files: z.array(fileSchema).optional(),
  conversation_id: z.number().int().positive().optional().nullable(),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().positive().optional(),
  codebase_collection: z.string().optional().nullable(),
});

async function forward(res: Response) {
  const text = await res.text();
  const contentType = res.headers.get('content-type') ?? 'application/json';
  return new Response(text, { status: res.status, headers: { 'Content-Type': contentType } });
}

function mapHarnessError(err: unknown) {
  if (err instanceof FetchTimeoutError) {
    return new Response(JSON.stringify({ error: 'harness_timeout' }), {
      status: 504,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  console.error('[code] harness unreachable', err);
  return new Response(JSON.stringify({ error: 'harness_unreachable' }), {
    status: 502,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function ensureOwnedCodeConversation(
  conversationId: number,
  orgId: number,
): Promise<{ ok: true } | { ok: false; response: Response }> {
  const existing = await getCodeConversation(conversationId);
  if (!existing.ok) return { ok: false, response: await forward(existing) };
  const body = (await existing.json()) as {
    conversation?: { org_id?: number } | null;
  };
  if (!body.conversation || Number(body.conversation.org_id) !== Number(orgId)) {
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: 'not_found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }),
    };
  }
  return { ok: true };
}

codeRoute.get('/conversations', async (c) => {
  const { orgId } = getAuthContext(c);
  try {
    const res = await listCodeConversations(Number(orgId));
    return forward(res);
  } catch (err) {
    return mapHarnessError(err);
  }
});

codeRoute.get('/conversations/:id', async (c) => {
  const { orgId } = getAuthContext(c);
  let conversationId: number;
  try {
    conversationId = assertInteger(c.req.param('id'), 'conversation_id');
  } catch {
    return c.json({ error: 'invalid_id' }, 400);
  }
  try {
    const res = await getCodeConversation(conversationId);
    if (!res.ok) return forward(res);
    const body = (await res.json()) as { conversation?: { org_id?: number } | null };
    if (!body.conversation || Number(body.conversation.org_id) !== Number(orgId)) {
      return c.json({ error: 'not_found' }, 404);
    }
    return c.json(body);
  } catch (err) {
    return mapHarnessError(err);
  }
});

codeRoute.get('/conversations/:id/messages', async (c) => {
  const { orgId } = getAuthContext(c);
  let conversationId: number;
  try {
    conversationId = assertInteger(c.req.param('id'), 'conversation_id');
  } catch {
    return c.json({ error: 'invalid_id' }, 400);
  }
  try {
    const owned = await ensureOwnedCodeConversation(conversationId, Number(orgId));
    if (!owned.ok) return owned.response;
    const res = await getCodeConversationMessages(conversationId);
    return forward(res);
  } catch (err) {
    return mapHarnessError(err);
  }
});

codeRoute.get('/conversations/:id/workspace', async (c) => {
  const { orgId } = getAuthContext(c);
  let conversationId: number;
  try {
    conversationId = assertInteger(c.req.param('id'), 'conversation_id');
  } catch {
    return c.json({ error: 'invalid_id' }, 400);
  }
  try {
    const owned = await ensureOwnedCodeConversation(conversationId, Number(orgId));
    if (!owned.ok) return owned.response;
    const res = await getCodeWorkspace(conversationId);
    return forward(res);
  } catch (err) {
    return mapHarnessError(err);
  }
});

const patchCodeSchema = z.object({
  title: z.string().min(1).max(200).optional(),
});

codeRoute.patch('/conversations/:id', async (c) => {
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
    const owned = await ensureOwnedCodeConversation(conversationId, Number(orgId));
    if (!owned.ok) return owned.response;
    const res = await updateCodeConversation(conversationId, parsed.data);
    return forward(res);
  } catch (err) {
    return mapHarnessError(err);
  }
});

codeRoute.post('/', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = codeSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'invalid_body', issues: parsed.error.issues }, 400);

  const { orgId } = getAuthContext(c);
  const payload = { ...parsed.data, org_id: Number(orgId) };

  try {
    const res = await harnessCode(payload);
    if (!res.ok) {
      const text = await res.text();
      console.error('[code] harness error', res.status, text);
      return c.json(
        { error: 'harness_error', status: res.status, detail: text.slice(0, 500) },
        502,
      );
    }
    const contentType = res.headers.get('content-type') ?? 'text/event-stream';
    return new Response(res.body, {
      status: res.status,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (err) {
    if (err instanceof FetchTimeoutError) {
      return c.json({ error: 'harness_timeout' }, 504);
    }
    console.error('[code] harness unreachable', err);
    return c.json({ error: 'harness_unreachable' }, 502);
  }
});
