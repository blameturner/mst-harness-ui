// frontend/src/api/home/overview.ts
import { http } from '../../lib/http';
import { defaultOrgId } from './config';
import type { HomeOverview } from './types';

export function getHomeOverview(orgId: number = defaultOrgId()) {
  return http
    .get('home/overview', { searchParams: { org_id: orgId } })
    .json<HomeOverview>();
}
