import { http } from '../../lib/http';
import type { AgentOutputRow } from '../types/AgentOutputRow';

export function getAgentOutputs(id: number) {
  return http
    .get(`api/agents/${id}/outputs`)
    .json<{ outputs: AgentOutputRow[]; page: number; limit: number; total: number }>();
}
