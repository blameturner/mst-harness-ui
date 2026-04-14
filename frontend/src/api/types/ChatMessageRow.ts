import type { ChatRole } from './ChatRole';
import type { ChatIntent } from './ChatIntent';
import type { IntentClassification } from './IntentClassification';
import type { SearchStatus } from './SearchStatus';
import type { SearchConfidence } from './SearchConfidence';
import type { SearchSource } from './SearchSource';

export interface ChatMessageRow {
  Id: number;
  conversation_id: number;
  role: ChatRole;
  content: string;
  model?: string;
  tokens_input?: number;
  tokens_output?: number;
  response_style?: string | null;
  search_used?: boolean;
  search_status?: SearchStatus;
  search_confidence?: SearchConfidence;
  search_source_count?: number;
  search_context_text?: string;
  search_sources?: SearchSource[];
  classification?: IntentClassification | null;
  intent?: ChatIntent | null;
  intent_entities?: string[] | null;
  search_queries?: string[] | null;
  search_status_reason?: string | null;
  CreatedAt?: string;
  pending_approval?: 0 | 1 | null;
}
