import type { QueueJob } from './QueueJob';
import type { QueueStatus } from './QueueStatus';
import type { PipelineSummary } from './PipelineSummary';

export interface HueyRuntime {
  enabled?: boolean;
  consumer_running?: boolean;
  workers?: number;
  sqlite_path?: string;
  queue_ready?: boolean;
}

export interface SchedulerEntry {
  id: string;
  next_run?: string | null;
}

export interface OpsDashboardResponse {
  status: string;
  error?: string;
  message?: string;
  org_id: number;
  queue?: QueueStatus;
  runtime?: {
    tool_queue_ready?: boolean;
    huey?: HueyRuntime;
  };
  scheduler?: {
    running?: boolean;
    next_run?: string | null;
    next_enrichment_run?: string | null;
    agent_schedules?: SchedulerEntry[];
    enrichment_schedules?: SchedulerEntry[];
  };
  discovery?: {
    count?: number;
    rows?: Array<Record<string, unknown>>;
  };
  scrape_targets?: {
    count?: number;
    rows?: Array<Record<string, unknown>>;
  };
  queue_jobs?: {
    count?: number;
    rows?: QueueJob[];
  };
  active_summary?: {
    active?: number;
    queued?: number;
    running?: number;
    org_id?: number;
  };
  pipeline?: PipelineSummary;
}

export interface EnrichmentRowResponse {
  status: string;
  row: Record<string, unknown> | null;
}

