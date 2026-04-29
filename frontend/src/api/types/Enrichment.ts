/** Scrape-target row status. `null` means the target has never been scraped. */
export type ScrapeTargetStatus = 'ok' | 'error' | 'rejected' | null;

/** Full schema for a row in the backend `scrape_targets` table. */
export interface ScrapeTargetRow {
  Id: number;
  org_id: number;
  url: string;
  name: string;
  category:
    | 'documentation'
    | 'news'
    | 'competitive'
    | 'regulatory'
    | 'research'
    | 'security'
    | 'model_releases'
    | 'auto';
  /** Stored as an int (0 = inactive, 1 = active). */
  active: 0 | 1;
  frequency_hours: number;
  enrichment_agent_id?: number;
  /** Self-referencing FK to parent scrape target. */
  parent_target?: number;
  /** NocoDB returns 0|1 on reads even though the schema is declared as Boolean. */
  use_playwright?: 0 | 1;
  /** sha256 of the last scraped content. */
  content_hash?: string;
  /** ISO timestamp. */
  last_scraped_at?: string;
  /** ISO timestamp. */
  next_crawl_at?: string;
  /** Nullable — `null` means the target has never been scraped. */
  status?: ScrapeTargetStatus;
  chunk_count?: number;
  consecutive_failures?: number;
  /** Max 500 chars. */
  last_scrape_error?: string;
  consecutive_unchanged?: number;
  /** 0 = root. */
  depth?: number;
  /** Parent URL that led to this target being discovered. */
  discovered_from?: string;
  /** Same NocoDB Boolean quirk as `use_playwright`. */
  auto_crawled?: 0 | 1;
  /** Populated by the summarise_page job. */
  summary?: string | null;
  /** FK back to suggested_scrape_targets if discovered via pathfinder. */
  suggested_id?: number | null;
  /** ISO timestamp, auto-populated by NocoDB. */
  CreatedAt: string;
}

export type ResearchStatus =
  | 'pending'
  | 'generating'
  | 'synthesizing'
  | 'critiquing'
  | 'searching'
  | 'reviewing'
  | 'revising'
  | 'completed'
  | 'failed'
  | 'hidden';

export interface ResearchDocType {
  key: string;
  opener?: string;
  closer?: string;
  tone?: string;
}

export interface ResearchDocTypesResponse {
  default: string;
  types: ResearchDocType[];
}

export interface ResearchArtifactEntry {
  text: string;
  generated_at: string;
}

export interface ResearchArtifacts {
  fact_check?: ResearchArtifactEntry;
  citation_audit?: ResearchArtifactEntry;
  slide_deck?: ResearchArtifactEntry;
  email_tldr?: ResearchArtifactEntry;
  qa_pack?: ResearchArtifactEntry;
  action_plan?: ResearchArtifactEntry;
  [key: string]: ResearchArtifactEntry | undefined;
}

export interface ResearchArtifactsResponse {
  plan_id: number;
  artifacts: ResearchArtifacts;
}

export type ResearchOpKind =
  | 'fact_check'
  | 'citation_audit'
  | 'expand_section'
  | 'add_section'
  | 'counter_arguments'
  | 'add_fresh_sources'
  | 'refresh_recency'
  | 'reframe'
  | 'resize'
  | 'slide_deck'
  | 'email_tldr'
  | 'qa_pack'
  | 'action_plan'
  | 'chat_with_paper';

export type ResearchOpResponse =
  | { status: 'queued'; job_id: string }
  | { status: 'ok'; [key: string]: unknown };

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
  type?: string | null;
  doc_type?: string | null;
  artifacts_json?: string | ResearchArtifacts | null;
  error_message?: string | null;
}

export interface ResearchPlansListResponse {
  items: ResearchPlan[];
  total: number;
}
