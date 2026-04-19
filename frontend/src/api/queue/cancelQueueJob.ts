import { http } from '../../lib/http';

export function cancelQueueJob(jobId: string) {
  return http.delete(`api/tool-queue/jobs/${encodeURIComponent(jobId)}`).json<{ cancelled: boolean }>();
}
