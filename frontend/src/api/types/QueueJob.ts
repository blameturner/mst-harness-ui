export interface QueueJob {
  job_id: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  priority: number;
  source: string;
  org_id: number;
  error: string;
  started_at: string;
  completed_at: string;
  depends_on: string;
}
