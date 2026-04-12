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
  search_enabled?: boolean;
  search_consent_declined?: boolean;
  search_mode?: 'normal' | 'deep';
  response_style?: string;
}
