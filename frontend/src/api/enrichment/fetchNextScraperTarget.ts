import { http } from '../../lib/http';
import type { ScraperPreviewResponse } from '../types/PipelineSummary';

export function fetchNextScraperTarget() {
  return http
    .post('api/enrichment/scraper/scrape-next')
    .json<ScraperPreviewResponse>();
}
