import { http } from '../../lib/http';
import type { SchedulerStatus } from '../types/SchedulerStatus';

export function getEnrichmentSchedulerStatus() {
  return http.get('api/enrichment/status').json<SchedulerStatus>();
}
