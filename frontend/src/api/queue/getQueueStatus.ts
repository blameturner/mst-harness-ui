import { http } from '../../lib/http';
import type { QueueStatus } from '../types/QueueStatus';

export function getQueueStatus() {
  return http.get('api/tool-queue/status').json<QueueStatus>();
}
