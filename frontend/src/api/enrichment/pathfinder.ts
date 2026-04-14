import { http } from '../../lib/http';
import type { DiscoveryListResponse } from '../types/Enrichment';

export interface DiscoverRequest {
  seed_url: string;
  max_depth?: number;
}

export function discover(payload: DiscoverRequest) {
  return http.post('api/enrichment/pathfinder/discover', { json: payload });
}

export function fetchNextUrl() {
  return http.post('api/enrichment/pathfinder/fetch-next');
}

export function markUrlProcessed(urlId: number) {
  return http.post('api/enrichment/pathfinder/mark-processed', { json: { url_id: urlId } });
}

export function listDiscovery(params?: { status?: string; limit?: number }) {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set('status', params.status);
  if (params?.limit) searchParams.set('limit', String(params.limit));
  return http.get(`api/enrichment/discovery/list?${searchParams}`).json<DiscoveryListResponse>();
}