import type { AgentOutput } from './AgentOutput';
import type { SearchStatus } from './SearchStatus';
import type { SearchConfidence } from './SearchConfidence';
import type { SearchSource } from './SearchSource';
import type { IntentClassification } from './IntentClassification';

export type StreamEvent =
  | { type: 'chunk'; text: string }
  | { type: 'meta'; conversation_id?: number; mode?: 'plan' | 'execute' | 'debug' }
  | {
      type: 'done';
      usage?: { prompt_tokens: number; completion_tokens: number };
      tokens_input?: number;
      tokens_output?: number;
      model?: string;
      conversation_id?: number;
      context_chars?: number;
      duration_seconds?: number;
      mode?: 'plan' | 'execute' | 'debug';
      output?: string;
      awaiting?: 'search_consent';
      search_used?: boolean;
      search_status?: SearchStatus;
      search_confidence?: SearchConfidence;
      search_source_count?: number;
    }
  | { type: 'summarised'; removed: number; summary_chars: number }
  | { type: 'parsed'; output: AgentOutput | null }
  | { type: 'searching' }
  | {
      type: 'search_complete';
      source_count: number;
      ok: boolean;
      confidence: SearchConfidence;
      sources: SearchSource[];
    }
  | {
      type: 'search_consent_required';
      query: string;
      reason: string;
    }
  | { type: 'plan_checklist'; steps: string[] }
  | { type: 'intent_classified'; classification: IntentClassification }
  | { type: 'search_deferred'; entities: string[] }
  | { type: 'error'; message: string };
