import type { AgentOutput } from './AgentOutput';
import type { SearchStatus } from './SearchStatus';
import type { SearchConfidence } from './SearchConfidence';
import type { SearchSource } from './SearchSource';
import type { ChatRoute } from './ChatRoute';
import type { ChatIntent } from './ChatIntent';

export type StreamEvent =
  | { type: 'chunk'; text: string }
  | { type: 'meta'; conversation_id?: number; mode?: 'plan' | 'execute' | 'debug'; estimate?: string; job_id?: string }
  | {
      type: 'done';
      usage?: { prompt_tokens: number; completion_tokens: number };
      tokens_input?: number;
      tokens_output?: number;
      model?: string;
      conversation_id?: number;
      context_chars?: number;
      duration_seconds?: number;
      mode?: 'plan' | 'execute' | 'debug' | 'research';
      output?: string;
      awaiting?: 'search_consent';
      search_used?: boolean;
      search_status?: SearchStatus;
      search_confidence?: SearchConfidence;
      search_source_count?: number;
      sources_count?: number;
    }
  | { type: 'summarised'; removed: number; summary_chars: number }
  | { type: 'parsed'; output: AgentOutput | null }
  | { type: 'searching'; queries?: string[] }
  | {
      type: 'tool_status';
      phase: 'planning' | 'start' | 'end';
      tool?: string;
      index?: number;
      reason?: string;
      summary?: string;
      tools?: string[];
      ok?: boolean;
      elapsed_s?: number;
    }
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
  | {
      type: 'intent_classified';
      route: ChatRoute;
      intent: ChatIntent;
      secondary_intent?: ChatIntent | null;
      entities: string[];
      confidence: number;
    }
  | { type: 'search_deferred'; entities: string[] }
  | { type: 'jobs_queued'; tool: string; message: string; status: string }
  | {
      type: 'research_status';
      phase: 'classifying' | 'searching' | 'scraping' | 'summarising' | 'synthesising';
      message: string;
      queries?: string[];
    }
  | { type: 'thinking'; text: string }
  | { type: 'error'; message: string };
