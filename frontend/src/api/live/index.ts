import { http } from '../../lib/http';
import { defaultOrgId } from '../home/config';
import { gatewayUrl } from '../../lib/runtime-env';

export interface ToolJob {
  job_id: string;
  type: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | string;
  created_at?: string;
  started_at?: string;
  completed_at?: string;
  source?: string;
  conversation_id?: number | null;
  priority?: number;
  error?: string;
  result_status?: string | null;
}
export interface ToolJobDeps {
  nodes: Array<{ id: string; kind: string; status: string }>;
  edges: Array<{ src: string; dst: string }>;
}

export interface EnrichmentSuggestion {
  id: string;
  kind: string;
  title?: string;
  summary?: string;
  created_at: string;
  source?: string;
  status: 'pending' | 'approved' | 'rejected' | 'deferred' | string;
  evidence_count?: number;
}
export interface EnrichmentPreview {
  id: string;
  diff?: string;
  proposed?: unknown;
  evidence?: Array<{ id: string; text: string; url?: string }>;
}

export type TriggerKind = 'insights' | 'digest' | 'seed_feedback' | 'pa';
export interface TriggerStatus {
  kind: TriggerKind | string;
  next_fire_at?: string;
  gate_state: 'open' | 'closed' | string;
  gate_reason?: string;
  candidates: Array<{ id: string; title?: string; score?: number }>;
}

const orgParam = () => ({ org_id: defaultOrgId() });

export const liveApi = {
  jobs: (params: { status?: string; kind?: string; limit?: number; since?: string } = {}) => {
    const searchParams: Record<string, string | number> = { ...orgParam() };
    for (const [k, v] of Object.entries(params)) if (v != null) searchParams[k] = v;
    return http.get('api/tool-queue/jobs', { searchParams }).json<{ jobs: ToolJob[] }>();
  },
  jobDependencies: (id: string) =>
    http
      .get(`api/tool-queue/jobs/${encodeURIComponent(id)}/dependencies`, { searchParams: orgParam() })
      .json<ToolJobDeps>(),
  enrichmentPending: (limit = 50) =>
    http
      .get('api/enrichment/suggestions/pending', {
        searchParams: { ...orgParam(), limit },
      })
      .json<{ suggestions: EnrichmentSuggestion[] }>(),
  enrichmentPreview: (id: string) =>
    http
      .get(`api/enrichment/suggestions/preview/${encodeURIComponent(id)}`, { searchParams: orgParam() })
      .json<EnrichmentPreview>(),
  enrichmentDecide: (id: string, decision: 'approve' | 'reject' | 'defer') =>
    http
      .post(`api/enrichment/suggestions/${encodeURIComponent(id)}/decision`, {
        json: { org_id: defaultOrgId(), decision },
      })
      .json<{ job_id?: string; ok: boolean }>(),
  triggerStatus: (kind: TriggerKind) =>
    http
      .get(`api/triggers/${encodeURIComponent(kind)}/next`, { searchParams: orgParam() })
      .json<TriggerStatus>(),
  triggerFireNow: (kind: TriggerKind) =>
    http
      .post(`api/triggers/${encodeURIComponent(kind)}/fire-now`, {
        json: { org_id: defaultOrgId() },
      })
      .json<{ job_id?: string; ok: boolean }>(),
};

// Endpoints for SSE streams that aren't routed through /api/stream/{id}.
export function liveJobLogStreamUrl(jobId: string): string {
  return `${gatewayUrl()}/api/tool-queue/jobs/${encodeURIComponent(jobId)}/logs?org_id=${defaultOrgId()}`;
}
export function liveEventStreamUrl(): string {
  return `${gatewayUrl()}/api/tool-queue/events/stream?org_id=${defaultOrgId()}`;
}
