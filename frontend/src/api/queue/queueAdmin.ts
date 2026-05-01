import { http } from '../../lib/http';

export type BulkAction = 'cancel' | 'retry' | 'set_priority' | 'tag' | 'untag';

export interface BulkActionRequest {
  job_ids: string[];
  action: BulkAction;
  priority?: number;
  tags?: string[];
  reason?: string;
}

export interface BulkActionResult {
  job_id: string;
  ok: boolean;
  error?: string;
  new_job_id?: string;
}

export async function bulkAction(req: BulkActionRequest): Promise<BulkActionResult[]> {
  const r = await http
    .post('api/tool-queue/bulk', { json: req })
    .json<{ results: BulkActionResult[] }>();
  return r.results ?? [];
}

export async function pauseType(jobType: string, paused: boolean) {
  return http
    .post('api/tool-queue/pause-type', { json: { job_type: jobType, paused } })
    .json<{ job_type: string; paused: boolean }>();
}

export async function listPausedTypes(): Promise<string[]> {
  const r = await http.get('api/tool-queue/paused-types').json<{ paused: string[] }>();
  return r.paused ?? [];
}

export interface DagResponse {
  root: string;
  nodes: Array<{ job_id: string; type: string; status: string; progress?: string | null }>;
  edges: Array<{ from: string; to: string; kind: 'depends_on' | 'parent' | 'child' }>;
}

export async function fetchJobDag(jobId: string, depth = 3): Promise<DagResponse> {
  return http
    .get(`api/tool-queue/dag/${encodeURIComponent(jobId)}`, { searchParams: { depth } })
    .json<DagResponse>();
}

export interface ReplayRequest {
  payload_overrides?: Record<string, unknown>;
  priority?: number;
  tags?: string[];
}

export async function replayJob(jobId: string, req: ReplayRequest = {}) {
  return http
    .post(`api/tool-queue/jobs/${encodeURIComponent(jobId)}/replay`, { json: req })
    .json<{ status: string; previous_job_id: string; job_id: string; type: string }>();
}

export interface ClearQueueRequest {
  include_running?: boolean;
  job_type?: string;
  org_id?: number;
  reason?: string;
}

export interface ClearQueueResponse {
  cancelled_queued: number;
  cancelled_running: number;
  scope: { job_type?: string | null; org_id?: number | null };
}

export async function clearQueue(req: ClearQueueRequest = {}): Promise<ClearQueueResponse> {
  return http.post('api/tool-queue/clear', { json: req }).json<ClearQueueResponse>();
}

export async function stopAllTypes(pause = true): Promise<{ count: number; paused?: string[]; resumed?: string[] }> {
  return http
    .post('api/tool-queue/stop-all', { json: { pause } })
    .json<{ count: number; paused?: string[]; resumed?: string[] }>();
}
