import { http } from '../../lib/http';

export function cancelQueueJob(jobId: string) {
  return http.post(`api/queue/jobs/${encodeURIComponent(jobId)}/cancel`).json();
}
