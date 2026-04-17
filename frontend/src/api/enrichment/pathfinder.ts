import { http } from '../../lib/http';
import type { DiscoveryListResponse, DiscoveryRow } from '../types/Enrichment';
import type { ChainKickResponse } from './chainKick';
import { normalizeList } from './_normalizeList';

export interface DiscoverRequest {
  seed_url: string;
  max_depth?: number;
}

/** Response shape for the now-async pathfinder discover endpoint. */
export interface PathfinderDiscoverResponse {
  status: 'queued';
  discovery_id: number;
  job_id: string;
}

export function discover(payload: DiscoverRequest) {
  // TODO Cycle 3: UI polling for the queued discovery_id / job_id.
  return http
    .post('api/enrichment/pathfinder/discover', { json: payload })
    .json<PathfinderDiscoverResponse>();
}

export function fetchNextUrl() {
  return http.post('api/enrichment/pathfinder/fetch-next');
}

export function markUrlProcessed(urlId: number) {
  return http.post('api/enrichment/pathfinder/mark-processed', {
    json: { url_id: urlId },
  });
}

export interface ListDiscoveryParams {
  status?: string;
  limit?: number;
  offset?: number;
  sort_by?: string;
  sort_dir?: 'asc' | 'desc';
}

export async function listDiscovery(params?: ListDiscoveryParams): Promise<DiscoveryListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set('status', params.status);
  if (params?.limit != null) searchParams.set('limit', String(params.limit));
  if (params?.offset != null) searchParams.set('offset', String(params.offset));
  if (params?.sort_by) searchParams.set('sort_by', params.sort_by);
  if (params?.sort_dir) searchParams.set('sort_dir', params.sort_dir);
  const raw = await http.get(`api/enrichment/discovery/list?${searchParams}`).json<unknown>();
  const normalized = normalizeList<DiscoveryRow>(raw, 'discovery/list');
  return { items: normalized.items, total: normalized.total };
}

/** Alias of the shared chain-kick response used by pathfinder start. */
export type PathfinderStartResponse = ChainKickResponse;

export function startPathfinder() {
  return http
    .post('api/enrichment/pathfinder/start')
    .json<PathfinderStartResponse>();
}
