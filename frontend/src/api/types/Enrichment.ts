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

export type ResearchStatus =
  | 'pending'
  | 'generating'
  | 'synthesizing'
  | 'critiquing'
  | 'complete'
  | 'completed'
  | 'failed';

export interface GapField {
  field: string;
  status: string;
  needed?: string;
}

export interface GapReport {
  gaps_found: GapField[];
  new_search_requirements: string[];
  confidence_score: number;
  ready_for_completion: boolean;
  notes?: string;
}

export interface ResearchPlan {
  Id: number;
  org_id: number;
  topic: string;
  hypotheses: string[];
  sub_topics: string[];
  queries: string[];
  schema: Record<string, string>;
  status: ResearchStatus;
  iterations?: number;
  max_iterations?: number;
  confidence_score?: number;
  confidence_threshold?: number;
  gap_report?: string | null;
  paper_content?: string | null;
  created_at: string;
}

export interface ResearchPlansListResponse {
  items: ResearchPlan[];
  total: number;
}