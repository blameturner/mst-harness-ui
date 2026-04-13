export type QueueEvent =
  | { type: 'job_queued'; job_id: string; job_type: string; priority: number }
  | { type: 'job_completed'; job_id: string; job_type: string; duration_s: number }
  | { type: 'job_failed'; job_id: string; job_type: string; error: string };
