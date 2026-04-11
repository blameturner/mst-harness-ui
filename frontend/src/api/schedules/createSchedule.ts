import { http } from '../../lib/http';
import type { AgentSchedule } from '../types/AgentSchedule';
import type { ScheduleCreateBody } from '../types/ScheduleCreateBody';

export function createSchedule(body: ScheduleCreateBody) {
  return http.post('api/schedules', { json: body }).json<AgentSchedule>();
}
