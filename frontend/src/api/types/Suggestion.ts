export type SuggestionRelevance = 'high' | 'medium' | 'low' | 'rejected';

export type SuggestionStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'extracted'
  | 'failed';

export interface Suggestion {
  Id: number;
  org_id: number;
  url: string;
  title: string | null;
  /** The LLM-generated search query that surfaced this URL. */
  query: string | null;
  relevance: SuggestionRelevance;
  /** 0-100 LLM-assigned. */
  score: number;
  /** One-sentence classifier justification. */
  reason: string | null;
  status: SuggestionStatus;
  error_message: string | null;
  /** ISO-8601, null until reviewed. */
  reviewed_at: string | null;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface ListSuggestionsResponse {
  status: 'ok' | 'failed';
  rows: Suggestion[];
  error?: string;
}

export interface ApproveSuggestionResponse {
  status: 'queued' | 'not_found' | 'failed';
  suggested_id?: number;
  job_id?: string;
  org_id?: number;
  error?: string;
}

export interface RejectSuggestionResponse {
  status: 'ok' | 'not_found' | 'failed';
  error?: string;
}

export interface PathfinderDiscoverResponse {
  status: 'queued' | 'failed';
  suggested_id?: number;
  job_id?: string;
  url?: string;
  error?: 'invalid_url' | 'invalid_org_id' | 'insert_failed' | string;
}
