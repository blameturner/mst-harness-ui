import { http } from '../../lib/http';
import type { ResearchPlansListResponse } from '../types/Enrichment';

export interface CreatePlanRequest {
  topic: string;
}

export function createResearchPlan(payload: CreatePlanRequest) {
  return http.post('api/enrichment/research/create-plan', { json: payload });
}

export function getNextResearchPlan() {
  return http.post('api/enrichment/research/get-next');
}

export function completeResearchPlan(planId: number) {
  return http.post('api/enrichment/research/complete', { json: { plan_id: planId } });
}

export function listResearchPlans(params?: { status?: string }) {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set('status', params.status);
  return http.get(`api/enrichment/research-plans-list?${searchParams}`).json<ResearchPlansListResponse>();
}