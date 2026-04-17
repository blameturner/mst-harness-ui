export interface QueueJob {
  job_id: string;
  type: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  priority: number;
  source: string;
  org_id: number;
  conversation_id?: number;
  url?: string;
  title?: string;
  error: string;
  started_at: string;
  completed_at: string;
  depends_on: string;
  task?: string;
  result_status?: string | null;
  payload?: Record<string, unknown>;
  result?: Record<string, unknown>;
  claimed_by?: string;
  nocodb_id?: number | null;
  created_at?: string;
}
