import { http } from '../../lib/http';
import { defaultOrgId } from '../home/config';

export type SimStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export const SIM_TERMINAL = new Set<SimStatus>(['completed', 'failed', 'cancelled']);

export function isSimTerminal(status: SimStatus | string | undefined | null): boolean {
  return !!status && SIM_TERMINAL.has(status as SimStatus);
}

export interface Participant {
  name: string;
  persona: string;
}

export interface Turn {
  turn: number;
  speaker: string;
  text: string;
}

export interface Sim {
  sim_id: number;
  title: string;
  scenario: string;
  participants: Participant[];
  status: SimStatus;
  max_turns: number;
  turn_count?: number;
  created_at?: string;
  started_at?: string;
  completed_at?: string;
  error?: string;
  transcript?: Turn[];
  debrief?: string;
}

export interface CreateSimulationRequest {
  title: string;
  scenario: string;
  participants: Participant[];
  max_turns?: number;
  org_id?: number;
}

export interface CreateSimulationResponse {
  status: string;
  sim_id: number;
  job_id?: string;
}

export interface CancelResponse {
  status: string;
  sim_id: number;
}

const orgParam = () => ({ org_id: defaultOrgId() });

export const simulationsApi = {
  list: (opts: { status?: SimStatus | 'all'; limit?: number } = {}) => {
    const searchParams: Record<string, string | number> = { ...orgParam() };
    if (opts.status && opts.status !== 'all') searchParams.status = opts.status;
    if (opts.limit) searchParams.limit = opts.limit;
    return http
      .get('api/simulations', { searchParams })
      .json<{ simulations: Sim[] }>();
  },
  get: (simId: number) =>
    http
      .get(`api/simulations/${simId}`, { searchParams: orgParam() })
      .json<Sim>(),
  create: (body: CreateSimulationRequest) =>
    http
      .post('api/simulations', {
        json: { org_id: defaultOrgId(), ...body },
      })
      .json<CreateSimulationResponse>(),
  cancel: (simId: number) =>
    http
      .post(`api/simulations/${simId}/cancel`, { json: orgParam() })
      .json<CancelResponse>(),
};
