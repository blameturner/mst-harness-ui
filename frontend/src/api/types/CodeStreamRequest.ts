import type { CodeFilePayload } from './CodeFilePayload';

export interface CodeStreamRequest {
  model: string;
  message: string;
  mode: 'plan' | 'execute' | 'explain' | 'review';
  approved_plan?: string | null;
  files?: CodeFilePayload[];
  conversation_id?: number | null;
  temperature?: number;
  max_tokens?: number;
  rag_enabled?: boolean;
  knowledge_enabled?: boolean;
  codebase_collection?: string | null;
  response_style?: string;
  search_enabled?: boolean;
}
