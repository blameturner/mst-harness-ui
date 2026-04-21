import type { SearchSource } from '../../api/types/SearchSource';
import type { SearchConfidence } from '../../api/types/SearchConfidence';
import type { ChatIntent } from '../../api/types/ChatIntent';
import type { SearchStatus } from '../../api/types/SearchStatus';
import type { SearchMode } from '../../api/types/SearchMode';
import type { MessageStatus } from './MessageStatus';

export interface AwaitingConsent {
  query: string;
  reason: string;
}

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
  searchMode?: SearchMode;
  searchQueryCount?: number;
  intent?: ChatIntent | null;
  searchStatus?: SearchStatus;
  searchContextText?: string;
  responseStyle?: string | null;
  sourceUserText?: string;
  parsedOutput?: unknown;
  toolStatus?: string;
  reconnecting?: boolean;
  thinkingContent?: string;
  thinkingStartTime?: number;
  thinkingEndTime?: number;
  isThinking?: boolean;
  topics?: string[];
  awaitingConsent?: AwaitingConsent;
}
