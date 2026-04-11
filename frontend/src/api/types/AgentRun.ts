export interface AgentRun {
  Id: number;
  agent_id: number;
  status: string;
  summary?: string | null;
  tokens_input?: number | null;
  tokens_output?: number | null;
  duration_seconds?: number | null;
  model_name?: string | null;
  CreatedAt?: string;
}
