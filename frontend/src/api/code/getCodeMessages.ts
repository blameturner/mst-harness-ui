import { http } from '../../lib/http';
import type { CodeConversation } from '../types/CodeConversation';
import type { CodeMessageRow } from '../types/CodeMessageRow';

export function getCodeMessages(id: number) {
  return http
    .get(`api/code/conversations/${id}/messages`)
    .json<{ conversation: CodeConversation; messages: CodeMessageRow[] }>();
}
