export interface DigestMeta {
  id: number;
  date: string;
  markdown: string | null;
  cluster_count: number;
  source_count: number;
  created_at: string;
}

export type InsightResearchStatus =
  | 'pending'
  | 'generating'
  | 'searching'
  | 'synthesizing'
  | 'completed'
  | 'failed';

export interface InsightResearchPlan {
  plan_id: number;
  focus: string;
  status: InsightResearchStatus;
  confidence: number | null;
  created_at: string;
  updated_at: string | null;
  completed_at: string | null;
}

export interface Question {
  id: number;
  org_id: number;
  question_text: string;
  suggested_options: { label: string; value: string }[];
  context_ref: string;
  followup_action: string;
  status: 'pending' | 'answered' | 'dismissed';
  answer_selected_option: string;
  answer_text: string;
  conversation_id: number | null;
  message_id: number | null;
  created_at: string;
  answered_at: string | null;
}

export interface Insight {
  id: number;
  org_id: number;
  title: string;
  topic: string;
  body_markdown: string;
  summary: string;
  trigger: 'chat_idle' | 'fallback_twice_daily' | 'manual' | 'question_followup';
  status: 'draft' | 'published' | 'archived';
  research_plan_id: number | null;
  related_entities: string[];
  sources: { url: string; title: string }[];
  created_at: string;
  surfaced_at: string | null;
}

export interface Schedule {
  id: number;
  agent_name: string;
  task_description: string;
  product: string;
  cron_expression: string;
  timezone: string;
  org_id: number;
  active: boolean;
  next_run_time: string | null;
}

export type FeedItemKind = 'digest' | 'insight' | 'question' | 'run';

export interface FeedItem {
  kind: FeedItemKind;
  id: number;
  title: string;
  snippet: string;
  created_at: string;
  ref: Record<string, unknown>;
}

export interface HomeConversationRef {
  id: number;
  title: string;
  model: string;
  last_message_at: string | null;
}

export interface WidgetEnvelope<T> {
  enabled: boolean;
  message: string;
  data: T | null;
}

export interface GraphWidgetData {
  top_entities: { type: string; name: string; degree: number }[];
  sparse_concepts: string[];
  recent_edges: { from: string; relationship: string; to: string }[];
}

export interface ActivityWidgetData {
  runs: {
    id: number;
    agent_name: string;
    status: string;
    summary: string;
    duration_seconds: number;
    tokens_total: number;
    created_at: string;
  }[];
}

export interface HomeOverview {
  org_id: number;
  digest: DigestMeta | null;
  pending_questions: Question[];
  recent_insights: Insight[];
  home_conversation: HomeConversationRef | null;
  schedules: Schedule[];
  widgets: {
    email: WidgetEnvelope<null>;
    calendar: WidgetEnvelope<null>;
    graph: WidgetEnvelope<GraphWidgetData>;
  };
}

export interface HomeHealth {
  scheduler_running: boolean;
  tables: {
    daily_digests: boolean;
    assistant_questions: boolean;
    insights: boolean;
    digest_feedback: boolean;
  };
  features: { home: boolean; daily_digest: boolean; insights: boolean };
  seconds_since_chat: number | null;
}
