import { http } from '../../lib/http';
import type { QueueJob } from '../types/QueueJob';

export function listQueueJobs(params?: {
  org_id?: number;
  type?: string;
  status?: string;
  source?: string;
  verbose?: boolean;
  limit?: number;
}) {
  const sp = new URLSearchParams();
  if (params?.org_id != null) sp.set('org_id', String(params.org_id));
  if (params?.type) sp.set('type', params.type);
  if (params?.status) sp.set('status', params.status);
  if (params?.source) sp.set('source', params.source);
  if (params?.verbose != null) sp.set('verbose', String(params.verbose));
  if (params?.limit) sp.set('limit', String(params.limit));
  const qs = sp.toString();
  return http.get(`api/tool-queue/jobs${qs ? `?${qs}` : ''}`).json<{ jobs: QueueJob[] }>();
}
