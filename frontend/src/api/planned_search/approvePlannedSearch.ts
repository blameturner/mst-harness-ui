import { http } from '../../lib/http';
import type { PlannedSearchApproveResponse } from './types';

export function approvePlannedSearch(messageId: number, orgId: number) {
  return http
    .post(`planned_search/${messageId}/approve`, {
      json: { org_id: orgId },
      timeout: 180_000,
    })
    .json<PlannedSearchApproveResponse>();
}
