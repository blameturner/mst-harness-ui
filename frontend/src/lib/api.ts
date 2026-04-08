import ky from 'ky';
import { gatewayUrl } from './runtime-env';

export const http = ky.create({
  prefixUrl: gatewayUrl(),
  credentials: 'include',
  timeout: 300_000,
});

export type Confidence = 'low' | 'medium' | 'high';

export interface AgentOutput {
  title: string;
  summary: string;
  domain: string;
  key_points: string[];
  recommendations: string[];
  next_steps: string[];
  observations: string[];
  follow_up_questions: string[];
  tags: string[];
  confidence: Confidence;
}

export interface RunResponse {
  success: boolean;
  agent: string;
  org_id: number;
  product: string;
  output: AgentOutput;
}

export interface Worker {
  Id: number;
  name: string;
  display_name: string;
  model: string;
  [k: string]: unknown;
}

export const api = {
  setupStatus: () => http.get('api/setup/status').json<{ configured: boolean }>(),
  setup: (body: {
    orgName: string;
    slug: string;
    email: string;
    password: string;
    displayName: string;
  }) => http.post('api/setup', { json: body }).json<{ success: boolean }>(),
  workers: () => http.get('api/workers').json<{ workers: Worker[] }>(),
  run: (body: { agent_name: string; task: string; product: string }) =>
    http.post('api/run', { json: body }).json<RunResponse>(),
  health: () => http.get('api/health').json<{ status: string; harness: string }>(),
  orgMe: () => http.get('api/org/me').json<{ org: any; user: any }>(),
};
