import type { EnrichmentCategory } from './EnrichmentCategory';

export interface SuggestedScrapeTarget {
  id: number;
  org_id: number;
  url: string;
  name: string;
  category: EnrichmentCategory;
  reason: string | null;
  confidence: 'high' | 'medium' | 'low';
  confidence_score: number;
  suggested_by_url: string | null;
  suggested_by_cycle: number | null;
  times_suggested: number;
  status: 'pending' | 'approved' | 'rejected' | 'already_exists';
  reviewed_by_user_id: number | null;
  reviewed_at: string | null;
  parent_target: number | null;
}
