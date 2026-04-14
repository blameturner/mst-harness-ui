export interface DiscoveryRow {
  Id: number;
  org_id: number;
  url: string;
  url_hash: string;
  source_url: string;
  depth: number;
  domain: string;
  status: 'newly_added' | 'discovered' | 'scraping' | 'scraped' | 'processed' | 'failed';
  error_message?: string;
}

export interface DiscoveryListResponse {
  items: DiscoveryRow[];
  total: number;
}

export interface ScraperRunRequest {
  batch_size: number;
}

export interface ScraperNextResponse {
  url?: string;
  url_id?: number;
  error?: string;
}

export interface ResearchPlan {
  Id: number;
  org_id: number;
  topic: string;
  hypotheses: string[];
  sub_topics: string[];
  queries: string[];
  schema: Record<string, string>;
  status: 'pending' | 'generating' | 'complete' | 'failed';
  created_at: string;
}

export interface ResearchPlansListResponse {
  items: ResearchPlan[];
  total: number;
}