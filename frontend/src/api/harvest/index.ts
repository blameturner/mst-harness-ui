import { http } from '../../lib/http';
import { defaultOrgId } from '../home/config';

export type HarvestStatus =
  | 'queued'
  | 'planning'
  | 'fetching'
  | 'extracting'
  | 'persisting'
  | 'completed'
  | 'failed'
  | 'cancelled';

export const TERMINAL_STATUSES = new Set<HarvestStatus>(['completed', 'failed', 'cancelled']);

export type HarvestPersistTarget =
  | 'knowledge'
  | 'knowledge_update'
  | 'graph_node'
  | 'artifacts';

export interface HarvestPolicy {
  name: string;
  seed_strategy: string;
  persist_target: HarvestPersistTarget | string;
  persist_mode?: string;
  max_pages?: number;
  max_cost_usd?: number;
  respect_robots?: boolean;
  walk_enabled?: boolean;
}

export interface HarvestRun {
  Id: number;
  policy: string;
  seed: string;
  params_json: string;
  status: HarvestStatus;
  urls_planned: number;
  urls_fetched: number;
  urls_persisted: number;
  urls_unchanged: number;
  urls_skipped: number;
  urls_failed: number;
  artifacts_json: string;
  cost_usd: number;
  started_at: string | null;
  finished_at: string | null;
  error_message: string | null;
  org_id: number;
  parent_run_id: number | null;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface HarvestArtifactsResponse {
  run_id: number;
  artifacts: Record<string, { items: Array<Record<string, unknown>>; by_url?: Record<string, unknown> }>;
}

export interface HarvestHostConfig {
  rate_limit_per_host_s?: number | null;
  respect_robots?: boolean | null;
  headless_fallback?: boolean | null;
  connection_id?: number | null;
  notes?: string | null;
}

export interface HarvestHostDetail {
  host: string;
  config: HarvestHostConfig;
  rate_limit_status?: {
    cool_off_until?: string | null;
    last_request_at?: string | null;
    [k: string]: unknown;
  };
}

export interface TriggerResponse {
  status: 'queued';
  run_id: number;
  job_id: string;
  policy: string;
}

const orgParam = (extra: Record<string, string | number | undefined> = {}) => {
  const params: Record<string, string | number> = { org_id: defaultOrgId() };
  for (const [k, v] of Object.entries(extra)) if (v != null) params[k] = v;
  return params;
};

export const harvestApi = {
  policies: () =>
    http.get('api/harvest/policies', { searchParams: orgParam() }).json<{ policies: HarvestPolicy[] }>(),

  runPolicy: (policy: string, body: { seed: string | string[]; params?: Record<string, unknown> }) =>
    http
      .post(`api/harvest/run/${encodeURIComponent(policy)}`, {
        json: { ...body, org_id: defaultOrgId() },
      })
      .json<TriggerResponse>(),

  scrapeNow: (url: string) =>
    http
      .post('api/harvest/scrape-now', { json: { url, org_id: defaultOrgId() } })
      .json<TriggerResponse>(),

  bulkUpload: (urls: string[]) =>
    http
      .post('api/harvest/bulk-upload', { json: { urls, org_id: defaultOrgId() } })
      .json<TriggerResponse>(),

  listRuns: (params: { policy?: string; status?: string; limit?: number } = {}) =>
    http
      .get('api/harvest/runs', { searchParams: orgParam(params) })
      .json<{ runs: HarvestRun[] }>(),

  getRun: (runId: number) =>
    http
      .get(`api/harvest/runs/${runId}`, { searchParams: orgParam() })
      .json<{ run: HarvestRun }>(),

  getArtifacts: (runId: number) =>
    http
      .get(`api/harvest/runs/${runId}/artifacts`, { searchParams: orgParam() })
      .json<HarvestArtifactsResponse>(),

  active: () =>
    http.get('api/harvest/active', { searchParams: orgParam() }).json<{ runs: HarvestRun[] }>(),

  runLog: (runId: number, tail = 100) =>
    http
      .get(`api/harvest/runs/${runId}/log`, { searchParams: orgParam({ tail }) })
      .json<{
        run_id: number;
        status: HarvestStatus;
        urls_planned: number;
        urls_fetched: number;
        urls_persisted: number;
        urls_failed: number;
        events: Array<{ ts: string; url: string; outcome: string; depth: number }>;
      }>(),

  cancelRun: (runId: number) =>
    http.post(`api/harvest/runs/${runId}/cancel`, { json: { org_id: defaultOrgId() } }).json<{ ok: boolean }>(),

  retryRun: (runId: number) =>
    http
      .post(`api/harvest/runs/${runId}/retry`, { json: { org_id: defaultOrgId() } })
      .json<TriggerResponse>(),

  hosts: () =>
    http.get('api/harvest/hosts', { searchParams: orgParam() }).json<{ hosts: Record<string, HarvestHostConfig> }>(),
  host: (host: string) =>
    http
      .get(`api/harvest/hosts/${encodeURIComponent(host)}`, { searchParams: orgParam() })
      .json<HarvestHostDetail>(),
  patchHost: (host: string, body: HarvestHostConfig) =>
    http
      .patch(`api/harvest/hosts/${encodeURIComponent(host)}`, {
        json: { ...body, org_id: defaultOrgId() },
      })
      .json<HarvestHostDetail>(),
  deleteHost: (host: string) =>
    http
      .delete(`api/harvest/hosts/${encodeURIComponent(host)}`, { searchParams: orgParam() })
      .json<{ ok: boolean }>(),
  reloadHosts: () =>
    http.post('api/harvest/hosts/reload', { json: { org_id: defaultOrgId() } }).json<{ ok: boolean }>(),
};

export function isTerminal(status: HarvestStatus | string): boolean {
  return TERMINAL_STATUSES.has(status as HarvestStatus);
}
