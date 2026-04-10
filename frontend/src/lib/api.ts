import ky from 'ky';
import { gatewayUrl } from './runtime-env';

export const http = ky.create({
  prefixUrl: gatewayUrl(),
  credentials: 'include',
  timeout: 300_000,
});

export type Confidence = 'low' | 'medium' | 'high';

export interface AgentOutput {
  title: string;
  summary: string;
  domain: string;
  key_points: string[];
  recommendations: string[];
  next_steps: string[];
  observations: string[];
  follow_up_questions: string[];
  tags: string[];
  confidence: Confidence;
}

export interface RunResponse {
  success: boolean;
  agent: string;
  org_id: number;
  product: string;
  output: AgentOutput;
}

export interface Worker {
  Id: number;
  name: string;
  display_name: string;
  model: string;
  [k: string]: unknown;
}

export interface LlmModel {
  name: string;
  url: string;
  role?: string;
  model_id?: string;
}

export interface Conversation {
  Id: number;
  org_id: number;
  model: string;
  title: string;
  CreatedAt?: string;
  UpdatedAt?: string;
}

export type ChatRole = 'user' | 'assistant' | 'system';

export interface ChatMessageRow {
  Id: number;
  conversation_id: number;
  role: ChatRole;
  content: string;
  model?: string;
  tokens_input?: number;
  tokens_output?: number;
  response_style?: string | null;
  CreatedAt?: string;
}

export interface StyleOption {
  key: string;
  prompt: string;
}

export interface StyleSurface {
  default: string;
  styles: StyleOption[];
}

export interface StylesResponse {
  chat?: StyleSurface;
  code?: StyleSurface;
}

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
    }
  | { type: 'summarised'; removed: number; summary_chars: number }
  | { type: 'parsed'; output: AgentOutput | null }
  | { type: 'searching' }
  | {
      type: 'search_complete';
      source_count: number;
      sources: string[];
      ok?: boolean;
    }
  | {
      type: 'search_consent_required';
      query: string;
      reason: string;
    }
  | { type: 'plan_checklist'; steps: string[] }
  | { type: 'error'; message: string };

export interface ChatStreamRequest {
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
  search_consent_declined?: boolean;
  response_style?: string;
}

export interface CodeFilePayload {
  name: string;
  content_b64: string;
}

export interface CodeStreamRequest {
  model: string;
  message: string;
  mode: 'plan' | 'execute' | 'debug';
  approved_plan?: string | null;
  files?: CodeFilePayload[];
  conversation_id?: number | null;
  temperature?: number;
  max_tokens?: number;
  codebase_collection?: string | null;
  response_style?: string;
}

export interface CodeConversation {
  Id: number;
  org_id: number;
  model: string;
  title: string;
  // mode is stored in the rag_collection column on the backend
  mode?: 'plan' | 'execute' | 'debug';
  rag_collection?: string | null;
  CreatedAt?: string;
  UpdatedAt?: string;
}

export interface CodeMessageRow {
  Id: number;
  conversation_id: number;
  role: ChatRole;
  content: string;
  mode?: 'plan' | 'execute' | 'debug' | null;
  files_json?: string | null;
  response_style?: string | null;
  CreatedAt?: string;
}

export interface CodeWorkspaceFile {
  name: string;
  content: string;
}

export interface RunStreamRequest {
  agent_name: string;
  task: string;
  product: string;
}

export interface ConversationSummary {
  conversation: Conversation;
  message_count: number;
  role_counts: Record<string, number>;
  observation_count: number;
  run_count: number;
  output_count: number;
  task_count: number;
  tokens_input: number;
  tokens_output: number;
  tokens_total: number;
  tokens_breakdown: {
    messages_input: number;
    messages_output: number;
    runs_input: number;
    runs_output: number;
    runs_context: number;
  };
  first_message_at: string | null;
  last_message_at: string | null;
  run_duration_seconds: number;
  chars_user: number;
  chars_assistant: number;
  models_used: string[];
  agents_used: string[];
  themes: string[];
  theme_counts: Record<string, number>;
  observation_types: string[];
  observation_confidences: Record<string, number>;
  observation_statuses: Record<string, number>;
  run_statuses: Record<string, number>;
  task_statuses: Record<string, number>;
  observations: Array<{
    Id: number;
    title: string;
    content: string;
    type: string;
    domain: string;
    confidence: string;
    status: string;
    source_run_id?: number;
    agent_id?: number;
    agent_name?: string;
    org_id: number;
    conversation_id: number;
    CreatedAt?: string;
  }>;
  runs: Array<{
    Id: number;
    agent_id: number;
    agent_name: string;
    agent_version?: number;
    status: string;
    summary?: string;
    tokens_input: number;
    tokens_output: number;
    context_tokens?: number;
    duration_seconds: number;
    quality_score?: number;
    model_name?: string;
    CreatedAt?: string;
  }>;
  outputs: Array<{
    Id: number;
    run_id: number;
    agent_name?: string;
    full_text: string;
    CreatedAt?: string;
  }>;
  tasks: unknown[];
}

export const ENRICHMENT_CATEGORIES = [
  'documentation',
  'news',
  'competitive',
  'regulatory',
  'research',
  'security',
  'model_releases',
] as const;
export type EnrichmentCategory = (typeof ENRICHMENT_CATEGORIES)[number];

export const ENRICHMENT_EVENT_TYPES = [
  'cycle_start',
  'cycle_end',
  'source_scraped',
  'source_unchanged',
  'source_rejected',
  'source_error',
  'suggestion_generated',
  'proactive_search',
  'budget_exhausted',
  'deferred',
] as const;
export type EnrichmentEventType = (typeof ENRICHMENT_EVENT_TYPES)[number];

export interface ScrapeTarget {
  id: number;
  org_id: number;
  name: string;
  url: string;
  category: EnrichmentCategory;
  frequency_hours: number;
  last_scraped_at: string | null;
  status: string | null;
  chunk_count: number;
  content_hash: string | null;
  active: boolean;
}

export interface EnrichmentLogEntry {
  id: number;
  org_id: number;
  scrape_target_id: number | null;
  cycle_id: string;
  event_type: EnrichmentEventType;
  source_url: string | null;
  message: string | null;
  chunks_stored: number | null;
  tokens_used: number | null;
  duration_seconds: number | null;
  flags: string[];
  created_at: string | null;
}

export interface SuggestedScrapeTarget {
  id: number;
  org_id: number;
  url: string;
  name: string;
  category: EnrichmentCategory;
  reason: string | null;
  confidence: 'high' | 'medium' | 'low';
  confidence_score: number;
  suggested_by_url: string | null;
  suggested_by_cycle: number | null;
  times_suggested: number;
  status: 'pending' | 'approved' | 'rejected' | 'already_exists';
  reviewed_by_user_id: number | null;
  reviewed_at: string | null;
}

export interface SchedulerStatus {
  running: boolean;
  next_run: string | null;
  sources_due: number;
}

export interface GraphCoverageNode {
  name: string;
  degree: number;
}

export interface AgentSummary {
  Id: number;
  name: string;
  display_name?: string;
  model?: string;
  status?: string | null;
  worker_type?: string;
  product?: string;
  task_description?: string;
  [k: string]: unknown;
}

export interface AgentRun {
  Id: number;
  agent_id: number;
  status: string;
  summary?: string | null;
  tokens_input?: number | null;
  tokens_output?: number | null;
  duration_seconds?: number | null;
  model_name?: string | null;
  CreatedAt?: string;
}

export interface AgentOutputRow {
  Id: number;
  run_id: number;
  agent_name?: string | null;
  full_text?: string | null;
  CreatedAt?: string;
}

export interface AgentSchedule {
  id: number;
  org_id: number;
  agent_name: string;
  cron_expression: string;
  timezone: string;
  task_description: string;
  product: string;
  active: boolean;
  reload_warning?: string;
}

export interface DockerContainer {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
}

export interface LogLine {
  container: string;
  id: string;
  ts: string;
  text: string;
  stderr?: boolean;
}

export interface ScheduleCreateBody {
  agent_name: string;
  cron_expression: string;
  timezone: string;
  task_description: string;
  product: string;
  active?: boolean;
}

export const api = {
  setupStatus: () => http.get('api/setup/status').json<{ configured: boolean }>(),
  setup: (body: {
    orgName: string;
    slug: string;
    email: string;
    password: string;
    displayName: string;
  }) => http.post('api/setup', { json: body }).json<{ success: boolean }>(),
  workers: () => http.get('api/workers').json<{ workers: Worker[] }>(),
  run: (body: { agent_name: string; task: string; product: string }) =>
    http.post('api/run', { json: body }).json<RunResponse>(),
  health: () => http.get('api/health').json<{ status: string; harness: string }>(),
  orgMe: () => http.get('api/org/me').json<{ org: any; user: any }>(),
  models: () => http.get('api/models').json<{ models: LlmModel[] }>(),
  styles: (surface?: 'chat' | 'code') =>
    http
      .get('api/styles', { searchParams: surface ? { surface } : {} })
      .json<StylesResponse>(),
  conversations: () =>
    http.get('api/conversations').json<{ conversations: Conversation[] }>(),
  conversationMessages: (conversationId: number) =>
    http
      .get(`api/conversations/${conversationId}/messages`)
      .json<{ conversation: Conversation; messages: ChatMessageRow[] }>(),
  conversationSummary: (conversationId: number) =>
    http
      .get(`api/conversations/${conversationId}/summary`)
      .json<ConversationSummary>(),
  renameConversation: (conversationId: number, title: string) =>
    http
      .patch(`api/conversations/${conversationId}`, { json: { title } })
      .json<{ conversation: Conversation }>(),
  chatStream: (body: ChatStreamRequest, signal?: AbortSignal) =>
    streamJob('api/chat', body, signal),
  codeStream: (body: CodeStreamRequest, signal?: AbortSignal) =>
    streamJob('api/code', body, signal),
  code: {
    conversations: () =>
      http
        .get('api/code/conversations')
        .json<{ conversations: CodeConversation[] }>(),
    conversation: (id: number) =>
      http
        .get(`api/code/conversations/${id}`)
        .json<{ conversation: CodeConversation }>(),
    messages: (id: number) =>
      http
        .get(`api/code/conversations/${id}/messages`)
        .json<{ conversation: CodeConversation; messages: CodeMessageRow[] }>(),
    workspace: (id: number) =>
      http
        .get(`api/code/conversations/${id}/workspace`)
        .json<{ files: CodeWorkspaceFile[] }>(),
    rename: (id: number, title: string) =>
      http
        .patch(`api/code/conversations/${id}`, { json: { title } })
        .json<{ conversation: CodeConversation }>(),
  },
  runStream: (body: RunStreamRequest, signal?: AbortSignal) =>
    streamJob('api/run/stream', body, signal),

  enrichment: {
    sources: () =>
      http.get('api/enrichment/sources').json<{ sources: ScrapeTarget[] }>(),
    createSource: (body: {
      name: string;
      url: string;
      category: EnrichmentCategory;
      frequency_hours: number;
      active?: boolean;
    }) => http.post('api/enrichment/sources', { json: body }).json<ScrapeTarget>(),
    updateSource: (id: number, body: Partial<ScrapeTarget>) =>
      http.patch(`api/enrichment/sources/${id}`, { json: body }).json<ScrapeTarget>(),
    deleteSource: (id: number) =>
      http.delete(`api/enrichment/sources/${id}`).json<{ ok: true }>(),
    triggerSource: (id: number) =>
      http.post(`api/enrichment/sources/${id}/trigger`).json<{ status: string }>(),
    flushSource: (id: number) =>
      http.post(`api/enrichment/sources/${id}/flush`).json<{ ok: true; note?: string }>(),
    log: (params: {
      cycle_id?: string;
      event_type?: string;
      scrape_target_id?: number;
      page?: number;
      limit?: number;
    }) => {
      const searchParams: Record<string, string> = {};
      if (params.cycle_id) searchParams.cycle_id = params.cycle_id;
      if (params.event_type) searchParams.event_type = params.event_type;
      if (params.scrape_target_id != null)
        searchParams.scrape_target_id = String(params.scrape_target_id);
      if (params.page != null) searchParams.page = String(params.page);
      if (params.limit != null) searchParams.limit = String(params.limit);
      return http
        .get('api/enrichment/log', { searchParams })
        .json<{ entries: EnrichmentLogEntry[]; page: number; limit: number; total: number }>();
    },
    suggestions: () =>
      http
        .get('api/enrichment/suggestions')
        .json<{ suggestions: SuggestedScrapeTarget[] }>(),
    reviewSuggestion: (
      id: number,
      body: { status: 'approved' | 'rejected'; frequency_hours?: number },
    ) => http.patch(`api/enrichment/suggestions/${id}`, { json: body }).json<{ ok: true }>(),
    status: () => http.get('api/enrichment/status').json<SchedulerStatus>(),
    triggerCycle: () =>
      http.post('api/enrichment/trigger').json<{ status: string }>(),
    graphCoverage: () =>
      http
        .get('api/enrichment/graph/coverage')
        .json<GraphCoverageNode[] | { nodes: GraphCoverageNode[] }>(),
  },

  agents: {
    list: () => http.get('api/agents').json<{ agents: AgentSummary[] }>(),
    get: (id: number) => http.get(`api/agents/${id}`).json<AgentSummary>(),
    runs: (id: number) =>
      http
        .get(`api/agents/${id}/runs`)
        .json<{ runs: AgentRun[]; page: number; limit: number; total: number }>(),
    outputs: (id: number) =>
      http
        .get(`api/agents/${id}/outputs`)
        .json<{ outputs: AgentOutputRow[]; page: number; limit: number; total: number }>(),
    workerTypes: () =>
      http
        .get('api/workers/types')
        .json<{ types: { id: string; name: string; description: string }[] }>(),
  },

  logs: {
    containers: () =>
      http.get('api/logs/containers').json<{ containers: DockerContainer[] }>(),
    streamUrl: (params?: { since?: number; tail?: number }) => {
      const sp = new URLSearchParams();
      if (params?.since != null) sp.set('since', String(params.since));
      if (params?.tail != null) sp.set('tail', String(params.tail));
      const qs = sp.toString();
      return `${gatewayUrl()}/api/logs/stream${qs ? `?${qs}` : ''}`;
    },
  },

  schedules: {
    list: () => http.get('api/schedules').json<{ schedules: AgentSchedule[] }>(),
    create: (body: ScheduleCreateBody) =>
      http.post('api/schedules', { json: body }).json<AgentSchedule>(),
    update: (id: number, body: Partial<ScheduleCreateBody>) =>
      http.patch(`api/schedules/${id}`, { json: body }).json<AgentSchedule>(),
    delete: (id: number) =>
      http.delete(`api/schedules/${id}`).json<{ ok: true; reload_warning?: string }>(),
  },
};

// POST to start a job, then open an EventSource to stream events.
// Uses a push queue so events yield immediately as they arrive rather than batching.
// Reconnects with cursor on disconnect so no events are lost.
async function* streamJob(
  path: string,
  body: unknown,
  signal?: AbortSignal,
): AsyncGenerator<StreamEvent, void, void> {
  const res = await fetch(`${gatewayUrl()}/${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    let detail = '';
    try {
      detail = await res.text();
    } catch {}
    yield { type: 'error', message: `HTTP ${res.status}${detail ? `: ${detail.slice(0, 300)}` : ''}` };
    return;
  }

  const { job_id } = (await res.json()) as { job_id: string };
  if (!job_id) {
    yield { type: 'error', message: 'No job_id returned' };
    return;
  }

  // Push queue: EventSource callbacks push, the generator pulls
  const queue: Array<StreamEvent | { __done: true } | { __reconnect: true }> = [];
  let waiting: ((v: void) => void) | null = null;
  function push(item: (typeof queue)[number]) {
    queue.push(item);
    if (waiting) { waiting(); waiting = null; }
  }
  async function pull() {
    while (queue.length === 0) {
      await new Promise<void>((r) => { waiting = r; });
    }
    return queue.shift()!;
  }

  let cursor = 0;
  let emptyRetries = 0;
  const MAX_EMPTY_RETRIES = 8;

  function connect() {
    const streamUrl = `${gatewayUrl()}/api/stream/${encodeURIComponent(job_id)}?cursor=${cursor}`;
    const es = new EventSource(streamUrl, { withCredentials: true });

    es.onopen = () => { emptyRetries = 0; };

    es.onmessage = (e) => {
      if (e.data === '[DONE]') {
        es.close();
        push({ __done: true });
        return;
      }
      if (e.lastEventId) cursor = parseInt(e.lastEventId, 10) + 1;
      try {
        push(JSON.parse(e.data) as StreamEvent);
      } catch {}
    };

    es.onerror = () => {
      es.close();
      push({ __reconnect: true });
    };

    return es;
  }

  let es = connect();

  // Reconnect on tab resume
  const onVisibility = () => {
    if (document.visibilityState === 'visible') {
      es.close();
      es = connect();
    }
  };
  document.addEventListener('visibilitychange', onVisibility);

  try {
    while (true) {
      if (signal?.aborted) return;

      const item = await pull();

      if ('__done' in item) return;

      if ('__reconnect' in item) {
        emptyRetries++;
        if (emptyRetries >= MAX_EMPTY_RETRIES) {
          yield { type: 'error', message: 'Stream connection lost' };
          return;
        }
        await new Promise((r) => setTimeout(r, 500 * Math.min(emptyRetries + 1, 4)));
        es = connect();
        continue;
      }

      yield item;
    }
  } finally {
    es.close();
    document.removeEventListener('visibilitychange', onVisibility);
  }
}
