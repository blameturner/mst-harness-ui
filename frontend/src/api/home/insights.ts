// frontend/src/api/home/insights.ts
import { http } from '../../lib/http';
import { defaultOrgId } from './config';
import type { Insight } from './types';

export function listInsights(opts: { orgId?: number; limit?: number } = {}) {
  const orgId = opts.orgId ?? defaultOrgId();
  const limit = opts.limit ?? 10;
  return http
    .get('home/insights', { searchParams: { org_id: orgId, limit } })
    .json<{ insights: Insight[] }>();
}

export function getInsight(id: number) {
  return http.get(`home/insights/${id}`).json<Insight>();
}
