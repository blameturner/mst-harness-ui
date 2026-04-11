import { http } from '../../lib/http';

export function deleteSchedule(id: number) {
  return http
    .delete(`api/schedules/${id}`)
    .json<{ ok: true; reload_warning?: string }>();
}
