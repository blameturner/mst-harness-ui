export type BackoffState = 'clear' | 'waiting_for_idle';

export interface QueueStatus {
  counts: Record<string, { queued: number; running: number; completed: number }>;
  workers: Record<string, number>;
  backoff: {
    state: BackoffState;
    /** -1 if no chat activity has been recorded yet. */
    idle_seconds: number;
    /** Single BACKGROUND_CHAT_IDLE_S gate. Default 30. */
    threshold: number;
  };
  huey?: {
    enabled?: boolean;
    consumer_running?: boolean;
    workers?: number;
    sqlite_path?: string;
    queue_ready?: boolean;
  };
}
