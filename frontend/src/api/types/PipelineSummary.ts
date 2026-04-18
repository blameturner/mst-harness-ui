// frontend/src/api/types/PipelineSummary.ts

export type PipelineKind = 'scraper' | 'pathfinder' | 'discover_agent';

export interface PipelineKindConfig {
  enabled?: boolean;
  interval_minutes?: number | null;
  cooldown_seconds?: number | null;
  [k: string]: unknown;
}

export interface PipelineConfig {
  scraper?: PipelineKindConfig;
  pathfinder?: PipelineKindConfig;
  discover_agent?: PipelineKindConfig;
  [k: string]: unknown;
}

export interface PipelineKindSchedule {
  next_run?: string | null;
  last_run?: string | null;
  cooldown_until?: string | null;
  [k: string]: unknown;
}

export interface PipelineSchedule {
  scraper?: PipelineKindSchedule;
  pathfinder?: PipelineKindSchedule;
  discover_agent?: PipelineKindSchedule;
  [k: string]: unknown;
}

export interface PipelineLastJob {
  job_id?: string | null;
  status?: string | null;
  result_status?: string | null;
  error?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  [k: string]: unknown;
}

export interface PipelineLastJobs {
  scraper?: PipelineLastJob | null;
  pathfinder?: PipelineLastJob | null;
  discover_agent?: PipelineLastJob | null;
  [k: string]: unknown;
}

/** Pathfinder preview: result of POST /enrichment/pathfinder/fetch-next. */
export interface PathfinderPreviewResponse {
  status: string;
  source?: 'discovery' | 'scrape_target_fallback' | string | null;
  row?: Record<string, unknown> | null;
  error?: string | null;
}

/** Scraper preview: result of POST /enrichment/scraper/scrape-next. */
export interface ScraperPreviewRow extends Record<string, unknown> {
  Id?: number;
  url?: string;
  _selection_bucket?: SelectionBucket | string | null;
}

export interface ScraperPreviewResponse {
  status: string;
  row?: ScraperPreviewRow | null;
  error?: string | null;
}

export type SelectionBucket =
  | 'manual_due'
  | 'manual_never'
  | 'auto_due'
  | 'auto_never'
  | 'auto_shallow_due'
  | 'auto_shallow_never';

export interface NextCandidates {
  pathfinder?: PathfinderPreviewResponse | null;
  scraper?: ScraperPreviewResponse | null;
  [k: string]: unknown;
}

export interface PipelineSummary {
  config?: PipelineConfig;
  schedule?: PipelineSchedule;
  last_jobs?: PipelineLastJobs;
  next_candidates?: NextCandidates;
  [k: string]: unknown;
}