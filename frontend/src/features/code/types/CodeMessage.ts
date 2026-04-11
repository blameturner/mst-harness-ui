import type { Mode } from './Mode';

export interface CodeMessage {
  id: string;
  role: 'user' | 'assistant';
  mode: Mode;
  content: string;
  status: 'complete' | 'streaming' | 'error';
  errorMessage?: string;
  responseStyle?: string | null;
  sourceUserText?: string;
  sourceMode?: Mode;
  sourceApprovedPlan?: string | null;
}
