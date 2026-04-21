import type { SearchMode } from './SearchMode';

export interface ChatStreamRequest {
  model: string;
  message: string;
  conversation_id?: number | null;
  system?: string | null;
  temperature?: number;
  max_tokens?: number;
  rag_enabled?: boolean;
  rag_collection?: string | null;
  knowledge_enabled?: boolean;
  search_mode?: SearchMode;
  search_consent_confirmed?: boolean;
  response_style?: string;
}
