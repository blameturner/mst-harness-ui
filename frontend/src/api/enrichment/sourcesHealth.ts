import { http } from '../../lib/http';

export interface SourceHealthDomain {
  domain: string;
  targets: number;
  active_targets: number;
  ok: number;
  errors: number;
  rejected: number;
  never_scraped: number;
  consecutive_failures_total: number;
  chunks_total: number;
  last_scraped_at: string | null;
  last_error: string | null;
  errors_recent: Array<{ url: string; error: string }>;
  success_rate: number | null;
}

export interface SourceHealthResponse {
  org_id: number;
  domains: SourceHealthDomain[];
  total_domains: number;
  total_targets: number;
}

export async function fetchSourcesHealth(limit = 100): Promise<SourceHealthResponse> {
  return http
    .get('api/enrichment/sources/health', { searchParams: { limit } })
    .json<SourceHealthResponse>();
}

export async function bumpScrapeTargets(query: string, limit = 10): Promise<{
  status: string;
  matched: number;
  tokens?: string[];
}> {
  return http
    .post('api/enrichment/scrape-targets/bump', { json: { query, limit } })
    .json<{ status: string; matched: number; tokens?: string[] }>();
}
