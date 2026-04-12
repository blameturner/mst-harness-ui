import { http } from '../../lib/http';

export function updateJobPriority(jobId: string, priority: number) {
  return http.patch(`api/queue/jobs/${encodeURIComponent(jobId)}/priority`, { json: { priority } }).json();
}
