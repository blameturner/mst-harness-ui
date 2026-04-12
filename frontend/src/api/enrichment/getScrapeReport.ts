import { http } from '../../lib/http';
import type { ScrapeReport } from '../types/ScrapeReport';

export function getScrapeReport() {
  return http.get('api/enrichment/scrape-report').json<ScrapeReport>();
}
