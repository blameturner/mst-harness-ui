import { http } from '../../lib/http';
import type { ChainKickResponse } from './chainKick';

/** Alias of the shared chain-kick response used by pathfinder start. */
export type PathfinderStartResponse = ChainKickResponse;

export function startPathfinder(orgId?: number) {
  const qs = orgId != null ? `?org_id=${encodeURIComponent(String(orgId))}` : '';
  return http
    .post(`api/enrichment/pathfinder/start${qs}`)
    .json<PathfinderStartResponse>();
}
