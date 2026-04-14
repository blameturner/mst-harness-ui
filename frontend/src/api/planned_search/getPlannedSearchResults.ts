import { http } from '../../lib/http';
import type { PlannedSearchResultsResponse } from './types';

export function getPlannedSearchResults(messageId: number, orgId: number) {
  return http
    .get(`planned_search/${messageId}/results`, {
      searchParams: { org_id: orgId },
    })
    .json<PlannedSearchResultsResponse>();
}
