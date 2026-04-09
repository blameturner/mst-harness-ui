export interface HarnessRunRequest {
  agent_name: string;
  task: string;
  product: string;
  org_id: number;
}

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
}

export interface HarnessCodeFile {
  name: string;
  content_b64: string;
}

export interface HarnessAgent {
  Id: number;
  name: string;
  display_name: string;
  model: string;
  status: string | null;
  org_id?: number;
  worker_type?: string;
  product?: string;
  task_description?: string;
}

export interface HarnessCodeRequest {
  org_id: number;
  model: string;
  message: string;
  mode: 'plan' | 'execute' | 'debug';
  approved_plan?: string | null;
  files?: HarnessCodeFile[];
  conversation_id?: number | null;
  temperature?: number;
  max_tokens?: number;
}
