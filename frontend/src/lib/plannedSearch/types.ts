export interface PlannedSearchQuery {
  query: string;
  reason: string;
}

export type PlannedSearchCardStatus =
  | 'proposed'
  | 'submitting'
  | 'synthesising'
  | 'completed'
  | 'rejected'
  | 'error';

export interface PlannedSearchState {
  proposalMessageId: number;
  queries: PlannedSearchQuery[];
  status: PlannedSearchCardStatus;
  answerMessageId?: number;
  errorMessage?: string;
}
