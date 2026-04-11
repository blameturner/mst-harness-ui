import { http } from '../../lib/http';
import type { CodeConversation } from '../types/CodeConversation';

export function getCodeConversation(id: number) {
  return http
    .get(`api/code/conversations/${id}`)
    .json<{ conversation: CodeConversation }>();
}
