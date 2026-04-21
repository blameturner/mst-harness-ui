export interface HarnessChatRequest {
  org_id: number;
  model: string;
  message: string;
  conversation_id?: number | null;
  system?: string | null;
  temperature?: number;
  max_tokens?: number;
  rag_enabled?: boolean;
  rag_collection?: string | null;
  knowledge_enabled?: boolean;
  search_mode?: 'disabled' | 'basic' | 'standard';
  search_consent_confirmed?: boolean;
  response_style?: string;
}
