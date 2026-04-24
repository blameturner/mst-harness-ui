// frontend/src/api/home/insights.ts
import { http } from '../../lib/http';
import { defaultOrgId } from './config';
import type { Insight, InsightResearchPlan } from './types';

export function listInsights(opts: { orgId?: number; limit?: number } = {}) {
  const orgId = opts.orgId ?? defaultOrgId();
  const limit = opts.limit ?? 10;
  return http
    .get('api/home/insights', { searchParams: { org_id: orgId, limit } })
    .json<{ insights: Insight[] }>();
}

export function getInsight(id: number) {
  return http.get(`api/home/insights/${id}`).json<Insight>();
}

export interface RequestInsightResearchResponse {
  plan_id: number;
  tool_job_id: string;
}

export function requestInsightResearch(
  id: number,
  focus: string,
  orgId: number = defaultOrgId(),
) {
  return http
    .post(`api/home/insights/${id}/research`, {
      json: { focus, org_id: orgId },
    })
    .json<RequestInsightResearchResponse>();
}

export function listInsightResearch(id: number) {
  return http
    .get(`api/home/insights/${id}/research`)
    .json<{ plans: InsightResearchPlan[] }>();
}
