import { http } from '../../lib/http';
import type { QueueJob } from '../types/QueueJob';

export function getQueueJob(jobId: string) {
  return http.get(`api/tool-queue/jobs/${encodeURIComponent(jobId)}`).json<QueueJob>();
}

