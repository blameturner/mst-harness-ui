export type SearchStatus =
  | 'not_used'
  | 'used'
  | 'failed'
  | 'no_results'
  | 'awaiting_approval'
  | 'approved'
  | 'completed'
  | 'queued'
  | 'deferred'
  | 'error'
  | 'consent_required'
  | 'declined';

/** Shared relevance scale used for search sources and related message metadata. */
export type Relevance = 'high' | 'medium' | 'low';
