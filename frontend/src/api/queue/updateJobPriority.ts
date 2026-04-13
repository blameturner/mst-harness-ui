import { http } from '../../lib/http';

export function updateJobPriority(jobId: string, priority: number) {
  return http.patch(`tool-queue/jobs/${encodeURIComponent(jobId)}/priority`, { json: { priority } }).json<{ updated: boolean; priority: number }>();
}
