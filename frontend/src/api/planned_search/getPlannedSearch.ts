import { http } from '../../lib/http';
import type { PlannedSearchStatusResponse } from './types';

export function getPlannedSearch(messageId: number) {
  return http
    .get(`planned_search/${messageId}`)
    .json<PlannedSearchStatusResponse>();
}
