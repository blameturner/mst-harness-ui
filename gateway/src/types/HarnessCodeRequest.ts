import type { HarnessCodeFile } from './HarnessCodeFile.js';

export interface HarnessCodeRequest {
  org_id: number;
  model: string;
  message: string;
  mode: 'plan' | 'execute' | 'explain' | 'review';
  approved_plan?: string | null;
  files?: HarnessCodeFile[];
  conversation_id?: number | null;
  temperature?: number;
  max_tokens?: number;
  codebase_collection?: string | null;
  response_style?: string;
}
