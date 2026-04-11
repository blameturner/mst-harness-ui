import { http } from '../../lib/http';
import type { AgentSchedule } from '../types/AgentSchedule';
import type { ScheduleCreateBody } from '../types/ScheduleCreateBody';

export function updateSchedule(id: number, body: Partial<ScheduleCreateBody>) {
  return http.patch(`api/schedules/${id}`, { json: body }).json<AgentSchedule>();
}
