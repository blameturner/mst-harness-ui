export interface QueueJob {
  job_id: string;
  type: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  priority: number;
  source: string;
  org_id: number;
  conversation_id?: number | null;
  url?: string | null;
  title?: string | null;
  error: string;
  started_at: string;
  completed_at: string;
  depends_on: string;
  task?: string | null;
  result_status?: string | null;
  payload?: Record<string, unknown>;
  result?: Record<string, unknown>;
  claimed_by?: string | null;
  nocodb_id?: number | null;
  created_at?: string;
  /** Latest human-readable progress message stamped by the handler. */
  progress?: string | null;
  /** ISO timestamp of the last progress update — useful to spot stuck jobs. */
  progress_at?: string | null;
  /** Phase label: "plan" | "search" | "synth" | "review" | "publish" | etc. */
  progress_kind?: string | null;
  /** Current step number within the phase (1-based) when known. */
  progress_step?: number | null;
  /** Total steps in the current phase when known. */
  progress_total?: number | null;
  /** Free-form tags attached by the handler. */
  tags?: string[] | null;
  /** Parent job id for fan-out flows (research_planner → research_agent). */
  parent_job_id?: string | null;
  /** Set when the job exhausted its retry budget. */
  dead_lettered_at?: string | null;
  /** Rolling-median completion duration for this job type (seconds). */
  median_duration_s?: number | null;
  /** Elapsed seconds since claim — only set on running jobs. */
  elapsed_s?: number | null;
  /** Estimated remaining seconds based on median - elapsed. */
  eta_seconds?: number | null;
  /** True when elapsed exceeds 1.5x median (UI flags as "running long"). */
  over_median?: boolean | null;
}
