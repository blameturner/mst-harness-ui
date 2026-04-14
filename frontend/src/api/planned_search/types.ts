import type { SearchStatus } from '../types/SearchStatus';
import type { SearchSource } from '../types/SearchSource';

export interface PlannedSearchStatusResponse {
  status: 'ok';
  message: {
    id: number;
    content: string;
    pending_approval: 0 | 1;
    search_status?: SearchStatus;
  };
}

export interface PlannedSearchApproveResponse {
  status: string;
  message_id: number;
  answer_message_id: number;
  queries_executed: number;
  results_found: number;
  successful_scrapes: number;
  answer_chars: number;
}

export interface PlannedSearchRejectResponse {
  status: string;
  message_id: number;
}

export interface PlannedSearchResultsResponse {
  status: 'ok';
  sources: SearchSource[];
}
