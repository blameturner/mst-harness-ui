import { http } from '../../lib/http';
import type { QueueJob } from '../types/QueueJob';

export function listQueueJobs() {
  return http.get('api/queue/jobs').json<{ jobs: QueueJob[] }>();
}
