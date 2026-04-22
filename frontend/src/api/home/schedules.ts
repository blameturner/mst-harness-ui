// frontend/src/api/home/schedules.ts
import { http } from '../../lib/http';
import { defaultOrgId } from './config';
import type { Schedule } from './types';

export function listSchedules(orgId: number = defaultOrgId()) {
  return http
    .get('api/home/schedules', { searchParams: { org_id: orgId } })
    .json<{ schedules: Schedule[] }>();
}
