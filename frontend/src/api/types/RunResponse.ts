import type { AgentOutput } from './AgentOutput';

export interface RunResponse {
  success: boolean;
  agent: string;
  org_id: number;
  product: string;
  output: AgentOutput;
}
