import type { EnrichmentCategory } from './EnrichmentCategory';

export interface ScrapeTarget {
  id: number;
  org_id: number;
  name: string;
  url: string;
  category: EnrichmentCategory;
  frequency_hours: number;
  last_scraped_at: string | null;
  status: string | null;
  chunk_count: number;
  content_hash: string | null;
  active: boolean;
  enrichment_agent_id: number | null;
  use_playwright: boolean;
  playwright_fallback: boolean;
  parent_target: number | null;
  depth?: number;
  next_crawl_at?: string | null;
  consecutive_unchanged?: number;
  discovered_from?: string | null;
  auto_crawled?: boolean;
}
