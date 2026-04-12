export type QueueEvent =
  | { type: 'job_queued'; job_id: string; job_type: string; position: number; queue_length: number }
  | { type: 'job_started'; job_id: string; job_type: string; estimated_s: number }
  | { type: 'job_completed'; job_id: string; duration_s: number }
  | { type: 'job_failed'; job_id: string; error: string }
  | { type: 'job_cancelled'; job_id: string };
