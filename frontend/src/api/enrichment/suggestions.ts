import { http } from '../../lib/http';
import type {
  ApproveSuggestionResponse,
  ListSuggestionsResponse,
  PathfinderDiscoverResponse,
  RejectSuggestionResponse,
  Suggestion,
  SuggestionStatus,
} from '../types/Suggestion';
import { normalizeList } from './_normalizeList';

export interface ListSuggestionsParams {
  org_id: number;
  /** Empty string requests all statuses. Default server-side: pending. */
  status?: SuggestionStatus | '';
  limit?: number;
}

export async function listSuggestions(
  params: ListSuggestionsParams,
): Promise<ListSuggestionsResponse> {
  const qs = new URLSearchParams();
  qs.set('org_id', String(params.org_id));
  if (params.status !== undefined) qs.set('status', params.status);
  if (params.limit != null) qs.set('limit', String(params.limit));
  const raw = await http.get(`api/enrichment/discovery/suggestions?${qs}`).json<unknown>();
  const normalized = normalizeList<Suggestion>(raw, 'discovery/suggestions');
  const status =
    raw && typeof raw === 'object' && typeof (raw as Record<string, unknown>).status === 'string'
      ? ((raw as Record<string, unknown>).status as ListSuggestionsResponse['status'])
      : 'ok';
  return { status, rows: normalized.items };
}

export function approveSuggestion(id: number): Promise<ApproveSuggestionResponse> {
  return http
    .post(`api/enrichment/discovery/suggestions/${encodeURIComponent(String(id))}/approve`)
    .json<ApproveSuggestionResponse>();
}

export function rejectSuggestion(
  id: number,
  reason?: string,
): Promise<RejectSuggestionResponse> {
  const qs = reason ? `?reason=${encodeURIComponent(reason)}` : '';
  return http
    .post(`api/enrichment/discovery/suggestions/${encodeURIComponent(String(id))}/reject${qs}`)
    .json<RejectSuggestionResponse>();
}

export function pathfinderDiscover(
  seed_url: string,
  org_id: number,
): Promise<PathfinderDiscoverResponse> {
  return http
    .post('api/enrichment/pathfinder/discover', { json: { seed_url, org_id } })
    .json<PathfinderDiscoverResponse>();
}
