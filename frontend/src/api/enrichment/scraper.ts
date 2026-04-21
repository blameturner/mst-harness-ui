import { http } from '../../lib/http';
import type { ChainKickResponse } from './chainKick';

/** Alias of the shared chain-kick response used by scraper start. */
export type ScraperStartResponse = ChainKickResponse;

export function startScraper(orgId?: number) {
  const qs = orgId != null ? `?org_id=${encodeURIComponent(String(orgId))}` : '';
  return http
    .post(`api/enrichment/scraper/start${qs}`)
    .json<ScraperStartResponse>();
}
