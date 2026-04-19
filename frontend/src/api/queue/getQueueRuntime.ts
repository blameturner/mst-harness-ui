import { http } from '../../lib/http';
import type { QueueStatus } from '../types/QueueStatus';

export function getQueueRuntime() {
  return http.get('api/tool-queue/runtime').json<{
    tool_queue_ready?: boolean;
    huey?: QueueStatus['huey'];
  }>();
}

