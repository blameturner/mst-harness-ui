import { http } from '../../lib/http';
import type { AgentRun } from '../types/AgentRun';

export function getAgentRuns(id: number) {
  return http
    .get(`api/agents/${id}/runs`)
    .json<{ runs: AgentRun[]; page: number; limit: number; total: number }>();
}
