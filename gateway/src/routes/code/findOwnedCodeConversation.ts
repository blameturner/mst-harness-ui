import { listCodeConversations } from '../../services/harness/index.js';
import { forwardResponse } from '../../lib/forwardResponse.js';
import type { HarnessCodeConversation } from './types/HarnessCodeConversation.js';

export async function findOwnedCodeConversation(
  conversationId: number,
  orgId: number,
): Promise<
  | { ok: true; conversation: HarnessCodeConversation }
  | { ok: false; response: Response }
> {
  const listRes = await listCodeConversations(orgId);
  if (!listRes.ok) return { ok: false, response: await forwardResponse(listRes) };
  const body = (await listRes.json()) as {
    conversations?: HarnessCodeConversation[];
  };
  const hit = (body.conversations ?? []).find(
    (c) => Number(c.Id ?? c.id) === Number(conversationId),
  );
  if (!hit || Number(hit.org_id) !== Number(orgId)) {
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: 'not_found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      }),
    };
  }
  return { ok: true, conversation: hit };
}
