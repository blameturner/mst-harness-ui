import { http } from '../../lib/http';
import type { ChainKickResponse } from './chainKick';

export function startDiscoverAgent(orgId?: number) {
  const qs = orgId != null ? `?org_id=${encodeURIComponent(String(orgId))}` : '';
  return http.post(`api/enrichment/discover-agent/start${qs}`).json<ChainKickResponse>();
}

