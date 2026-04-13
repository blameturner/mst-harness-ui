import type { SearchSource } from '../../api/types/SearchSource';
import type { SearchConfidence } from '../../api/types/SearchConfidence';
import type { ChatIntent } from '../../api/types/ChatIntent';
import type { SearchStatus } from '../../api/types/SearchStatus';
import type { MessageStatus } from './MessageStatus';

export interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model?: string;
  status: MessageStatus;
  startedAt?: number;
  tokensIn?: number;
  tokensOut?: number;
  contextChars?: number;
  errorMessage?: string;
  sources?: SearchSource[];
  searchConfidence?: SearchConfidence;
  intent?: ChatIntent | null;
  searchStatus?: SearchStatus;
  responseStyle?: string | null;
  sourceUserText?: string;
  parsedOutput?: unknown;
  toolStatus?: string;
  reconnecting?: boolean;
  thinkingContent?: string;
  thinkingStartTime?: number;
  thinkingEndTime?: number;
  isThinking?: boolean;
  deepSearchPlan?: {
    queries: string[];
    sources: SearchSource[];
    status: 'awaiting_approval' | 'approved' | 'revised';
  };
  researchPlan?: {
    question: string;
    objective: string;
    queries: string[];
    lookout: string[];
    completionCriteria: string[];
    status: 'awaiting_approval' | 'approved' | 'revised';
  };
  deepSearchStatus?: 'waiting' | 'done';
  deepSearchMessage?: string;
  topics?: string[];
}
