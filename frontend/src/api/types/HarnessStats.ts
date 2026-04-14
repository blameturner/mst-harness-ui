export interface HarnessStats {
  total_requests: number;
  total_tokens_input: number;
  total_tokens_output: number;
  total_conversations: number;
  total_errors: number;
  period_start: string;
  period_end: string;
  by_model: {
    model_name: string;
    requests: number;
    tokens_input: number;
    tokens_output: number;
    avg_tokens_per_request: number;
    avg_duration_seconds: number;
    p50_duration_seconds: number;
    p95_duration_seconds: number;
    p99_duration_seconds: number;
    time_to_first_token_ms: number;
    error_count: number;
    error_rate: number;
  }[];
  by_day: { date: string; requests: number; tokens_input: number; tokens_output: number; errors: number }[];
  by_hour: { hour: number; day_of_week: number; requests: number }[];
  by_style: { style: string; requests: number }[];
  top_conversations: {
    conversation_id: number;
    title: string;
    message_count: number;
    total_tokens: number;
    last_active: string;
  }[];
  agent_runs: {
    total_runs: number;
    successful: number;
    failed: number;
    avg_steps: number;
    by_agent: { agent_name: string; runs: number; success_rate: number; avg_steps: number }[];
  };
}
