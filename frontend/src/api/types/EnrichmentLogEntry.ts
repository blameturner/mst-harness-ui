import type { EnrichmentEventType } from './EnrichmentEventType';

export interface EnrichmentLogEntry {
  id: number;
  org_id: number;
  scrape_target_id: number | null;
  cycle_id: string;
  event_type: EnrichmentEventType;
  source_url: string | null;
  message: string | null;
  chunks_stored: number | null;
  tokens_used: number | null;
  duration_seconds: number | null;
  flags: string[];
  created_at: string | null;
}
