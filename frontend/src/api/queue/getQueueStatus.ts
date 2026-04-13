import { http } from '../../lib/http';
import type { QueueStatus } from '../types/QueueStatus';

export function getQueueStatus() {
  return http.get('tool-queue/status').json<QueueStatus>();
}
