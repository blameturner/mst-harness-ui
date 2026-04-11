import { http } from '../../lib/http';

export async function patchConversation(
  id: number,
  body: { title?: string; contextual_grounding_enabled?: boolean },
): Promise<void> {
  await http.patch(`api/conversations/${id}`, { json: body });
}
