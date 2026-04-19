import { http } from '../../lib/http';

export interface RetryQueueJobResponse {
  status: 'queued' | 'failed' | string;
  previous_job_id?: string;
  job_id?: string;
  type?: string;
  error?: string;
}

export function retryQueueJob(jobId: string) {
  return http
    .post(`api/tool-queue/jobs/${encodeURIComponent(jobId)}/retry`)
    .json<RetryQueueJobResponse>();
}
