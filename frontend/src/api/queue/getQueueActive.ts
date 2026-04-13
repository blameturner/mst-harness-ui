import { http } from '../../lib/http';
import type { QueueActive } from '../types/QueueActive';

export function getQueueActive(params?: {
  conversation_id?: number;
  source?: string;
}) {
  const sp = new URLSearchParams();
  if (params?.conversation_id != null) sp.set('conversation_id', String(params.conversation_id));
  if (params?.source) sp.set('source', params.source);
  const qs = sp.toString();
  return http.get(`api/queue/active${qs ? `?${qs}` : ''}`).json<QueueActive>();
}
