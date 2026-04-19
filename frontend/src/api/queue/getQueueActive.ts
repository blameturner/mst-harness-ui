import { http } from '../../lib/http';
import type { QueueActive } from '../types/QueueActive';

export function getQueueActive(params?: {
  org_id?: number;
  conversation_id?: number;
  source?: string;
}) {
  const sp = new URLSearchParams();
  if (params?.org_id != null) sp.set('org_id', String(params.org_id));
  if (params?.conversation_id != null) sp.set('conversation_id', String(params.conversation_id));
  if (params?.source) sp.set('source', params.source);
  const qs = sp.toString();
  return http.get(`api/tool-queue/active${qs ? `?${qs}` : ''}`).json<QueueActive>();
}
