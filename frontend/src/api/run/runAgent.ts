import { http } from '../../lib/http';
import type { RunResponse } from '../types/RunResponse';

export function runAgent(body: { agent_name: string; task: string; product: string }) {
  return http.post('api/run', { json: body }).json<RunResponse>();
}
