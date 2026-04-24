import { http } from '../../lib/http';

export interface RunQueueJobNowResponse {
  status: 'running' | 'queued' | 'failed' | string;
  job_id?: string;
  error?: string;
}

export function runQueueJobNow(jobId: string) {
  return http
    .post(`api/tool-queue/jobs/${encodeURIComponent(jobId)}/run-now`)
    .json<RunQueueJobNowResponse>();
}
