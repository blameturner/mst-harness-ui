import { http } from '../../lib/http';
import type { OpsDashboardResponse } from '../types/OpsDashboard';
import type { QueueJob } from '../types/QueueJob';

export function getQueueDashboard(params: { org_id: number; limit?: number }) {
  const sp = new URLSearchParams();
  sp.set('org_id', String(params.org_id));
  if (params.limit != null) sp.set('limit', String(params.limit));
  return http.get(`api/tool-queue/dashboard?${sp.toString()}`).json<{
    queue?: OpsDashboardResponse['queue'];
    runtime?: OpsDashboardResponse['runtime'];
    scheduler?: OpsDashboardResponse['scheduler'];
    recent_jobs?: QueueJob[];
    active_summary?: OpsDashboardResponse['active_summary'];
  }>();
}


