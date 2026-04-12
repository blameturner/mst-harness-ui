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
  toolStatus?: string;
  reconnecting?: boolean;
  thinkingContent?: string;
  thinkingStartTime?: number;
  thinkingEndTime?: number;
  isThinking?: boolean;
}
