import { http } from '../../lib/http';
import type { AgentSummary } from '../types/AgentSummary';

export function listAgents() {
  return http.get('api/agents').json<{ agents: AgentSummary[] }>();
}
