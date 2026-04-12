export interface QueueJob {
  job_id: string;
  type: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  priority: number;
  elapsed_s?: number;
  error?: string;
}
