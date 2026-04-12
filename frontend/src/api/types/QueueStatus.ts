export interface QueueStatus {
  queue_length: number;
  current_job: { job_id: string; type: string; elapsed_s: number } | null;
  estimated_wait_s: number;
}
