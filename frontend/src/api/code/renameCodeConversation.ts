import { http } from '../../lib/http';
import type { CodeConversation } from '../types/CodeConversation';

export function renameCodeConversation(id: number, title: string) {
  return http
    .patch(`api/code/conversations/${id}`, { json: { title } })
    .json<{ conversation: CodeConversation }>();
}
