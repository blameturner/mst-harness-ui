export interface AgentSummary {
  Id: number;
  name: string;
  display_name?: string;
  model?: string;
  status?: string | null;
  worker_type?: string;
  product?: string;
  task_description?: string;
  [k: string]: unknown;
}
