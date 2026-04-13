import { http } from '../../lib/http';

export function deleteCodeConversation(id: number) {
  return http
    .patch(`api/code/conversations/${id}`, {
      json: { deleted_at: new Date().toISOString() },
    })
    .json();
}
