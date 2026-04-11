import type { Conversation } from './Conversation';

export interface ConversationSummary {
  conversation: Conversation;
  message_count: number;
  role_counts: Record<string, number>;
  observation_count: number;
  run_count: number;
  output_count: number;
  task_count: number;
  tokens_input: number;
  tokens_output: number;
  tokens_total: number;
  tokens_breakdown: {
    messages_input: number;
    messages_output: number;
    runs_input: number;
    runs_output: number;
    runs_context: number;
  };
  first_message_at: string | null;
  last_message_at: string | null;
  run_duration_seconds: number;
  chars_user: number;
  chars_assistant: number;
  models_used: string[];
  agents_used: string[];
  themes: string[];
  theme_counts: Record<string, number>;
  observation_types: string[];
  observation_confidences: Record<string, number>;
  observation_statuses: Record<string, number>;
  run_statuses: Record<string, number>;
  task_statuses: Record<string, number>;
  observations: Array<{
    Id: number;
    title: string;
    content: string;
    type: string;
    domain: string;
    confidence: string;
    status: string;
    source_run_id?: number;
    agent_id?: number;
    agent_name?: string;
    org_id: number;
    conversation_id: number;
    CreatedAt?: string;
  }>;
  runs: Array<{
    Id: number;
    agent_id: number;
    agent_name: string;
    agent_version?: number;
    status: string;
    summary?: string;
    tokens_input: number;
    tokens_output: number;
    context_tokens?: number;
    duration_seconds: number;
    quality_score?: number;
    model_name?: string;
    CreatedAt?: string;
  }>;
  outputs: Array<{
    Id: number;
    run_id: number;
    agent_name?: string;
    full_text: string;
    CreatedAt?: string;
  }>;
  tasks: unknown[];
}
