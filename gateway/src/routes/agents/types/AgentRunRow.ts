export type AgentRunRow = {
  Id: number;
  agent_id: number;
  org_id: number;
  status: string;
  summary?: string | null;
  tokens_input?: number | null;
  tokens_output?: number | null;
  context_tokens?: number | null;
  duration_seconds?: number | null;
  quality_score?: number | null;
  model_name?: string | null;
  CreatedAt?: string;
};
