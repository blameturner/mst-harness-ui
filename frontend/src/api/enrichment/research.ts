import { http } from '../../lib/http';
import type { ResearchPlan, ResearchPlansListResponse } from '../types/Enrichment';
import { normalizeList } from './_normalizeList';

// Harness stores JSON-encoded strings in these columns. Parse at the boundary so
// the rest of the UI can rely on the shapes declared in ResearchPlan.
function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string' || value.length === 0) {
    return (value as T) ?? fallback;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function parsePlan(raw: unknown): ResearchPlan {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    ...(r as unknown as ResearchPlan),
    hypotheses: parseJson<string[]>(r.hypotheses, []),
    sub_topics: parseJson<string[]>(r.sub_topics, []),
    queries: parseJson<string[]>(r.queries, []),
    schema: parseJson<Record<string, string>>(r.schema, {}),
    gap_report:
      typeof r.gap_report === 'string' && r.gap_report.length > 0
        ? (r.gap_report as string)
        : null,
  };
}

export interface CreatePlanRequest {
  topic: string;
}

export interface AgentRunRequest {
  plan_id: number;
}

/** Response shape for the async research-plan creation endpoint. */
export interface CreateResearchPlanResponse {
  status: 'queued';
  plan_id: number;
  job_id: string;
}

export function createResearchPlan(payload: CreatePlanRequest) {
  return http
    .post('api/enrichment/research/create-plan', { json: payload })
    .json<CreateResearchPlanResponse>();
}

export function getNextResearchPlan() {
  return http.post('api/enrichment/research/get-next');
}

export function completeResearchPlan(planId: number) {
  return http.post('api/enrichment/research/complete', {
    json: { plan_id: planId },
  });
}

export function runResearchAgent(payload: AgentRunRequest) {
  return http.post('api/enrichment/research/agent/run', { json: payload });
}

export function nextResearchAgent(payload?: AgentRunRequest) {
  return http.post('api/enrichment/research/agent/next', { json: payload ?? {} });
}

export function deleteResearchPlan(_planId: number): Promise<void> {
  // No backend endpoint; callers rendered as disabled. Kept for signature stability.
  // eslint-disable-next-line no-console
  console.warn('[research] deleteResearchPlan: no backend endpoint; no-op');
  return Promise.resolve();
}

export function updateResearchPlanQueries(_planId: number, _queries: string[]): Promise<void> {
  // No backend endpoint; callers rendered as disabled. Kept for signature stability.
  // eslint-disable-next-line no-console
  console.warn('[research] updateResearchPlanQueries: no backend endpoint; no-op');
  return Promise.resolve();
}

export async function listResearchPlans(params?: { status?: string }): Promise<ResearchPlansListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set('status', params.status);
  const raw = await http.get(`api/enrichment/research-plans/list?${searchParams}`).json<unknown>();
  const normalized = normalizeList<unknown>(raw, 'research-plans/list');
  return { items: normalized.items.map(parsePlan), total: normalized.total };
}

export async function getResearchPlan(planId: number): Promise<ResearchPlan | null> {
  const raw = await http
    .get(`api/enrichment/research-plans/${planId}`)
    .json<{ status?: string; row?: unknown } | unknown>();
  const r = (raw ?? {}) as Record<string, unknown>;
  if (r.status === 'not_found' || r.row == null) return null;
  return parsePlan(r.row);
}
