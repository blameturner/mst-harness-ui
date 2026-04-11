import { http } from '../../lib/http';
import type { Conversation } from '../types/Conversation';

export function listConversations() {
  return http.get('api/conversations').json<{ conversations: Conversation[] }>();
}
