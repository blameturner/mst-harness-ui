import { http } from '../../lib/http';
import type { QueueJob } from '../types/QueueJob';

export function listQueueJobs(params?: { type?: string; status?: string; source?: string; limit?: number }) {
  const sp = new URLSearchParams();
  if (params?.type) sp.set('type', params.type);
  if (params?.status) sp.set('status', params.status);
  if (params?.source) sp.set('source', params.source);
  if (params?.limit) sp.set('limit', String(params.limit));
  const qs = sp.toString();
  return http.get(`api/queue/jobs${qs ? `?${qs}` : ''}`).json<{ jobs: QueueJob[] }>();
}
