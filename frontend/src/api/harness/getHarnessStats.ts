import { http } from '../../lib/http';
import type { HarnessStats } from '../types/HarnessStats';

export function getHarnessStats(period: '7d' | '30d' | 'all' = '7d') {
  return http
    .get('api/harness/stats/usage', { searchParams: { period } })
    .json<HarnessStats>();
}
