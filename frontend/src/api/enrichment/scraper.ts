import { http } from '../../lib/http';

export interface ScraperRunRequest {
  batch_size?: number;
}

export function runScraper(payload?: ScraperRunRequest) {
  return http.post('api/enrichment/scraper/run', { json: payload ?? {} });
}

export function scrapeNext() {
  return http.post('api/enrichment/scraper/scrape-next');
}