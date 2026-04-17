import { http } from '../../lib/http';
import type { OpsDashboardResponse } from '../types/OpsDashboard';

export function getOpsDashboard(params: { org_id: number; limit?: number }) {
  const searchParams = new URLSearchParams();
  searchParams.set('org_id', String(params.org_id));
  if (params.limit != null) searchParams.set('limit', String(params.limit));
  return http.get(`api/ops/dashboard?${searchParams.toString()}`).json<OpsDashboardResponse>();
}

