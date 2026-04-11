import { http } from '../../lib/http';
import type { Conversation } from '../types/Conversation';

export function renameConversation(conversationId: number, title: string) {
  return http
    .patch(`api/conversations/${conversationId}`, { json: { title } })
    .json<{ conversation: Conversation }>();
}
