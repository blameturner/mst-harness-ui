export type BackoffState = 'active' | 'priority_1_only' | 'priority_1_2_only' | 'clear';

export interface QueueStatus {
  counts: Record<string, { queued: number; running: number; completed: number }>;
  workers: Record<string, number>;
  backoff: {
    state: BackoffState;
    idle_seconds: number;
    thresholds: {
      research: number;
      deep_search: number;
      background: number;
    };
  };
}
