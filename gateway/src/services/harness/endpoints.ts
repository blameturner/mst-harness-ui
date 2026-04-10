import { harnessClient } from './client.js';
import {
  HARNESS_CHAT_TIMEOUT_MS,
  HARNESS_CONVERSATIONS_TIMEOUT_MS,
  HARNESS_ENRICHMENT_TIMEOUT_MS,
  HARNESS_HEALTH_TIMEOUT_MS,
  HARNESS_MODELS_TIMEOUT_MS,
  HARNESS_RUN_TIMEOUT_MS,
  HARNESS_SCHEDULER_TIMEOUT_MS,
} from '../../constants/timeouts.js';
import type {
  HarnessChatRequest,
  HarnessCodeRequest,
  HarnessRunRequest,
} from '../../types/harness.js';

export function health(): Promise<Response> {
  return harnessClient.get('/health', HARNESS_HEALTH_TIMEOUT_MS);
}

export function listModels(): Promise<Response> {
  return harnessClient.get('/models', HARNESS_MODELS_TIMEOUT_MS);
}

export function listStyles(surface?: 'chat' | 'code'): Promise<Response> {
  const q = surface ? `?surface=${surface}` : '';
  return harnessClient.get(`/styles${q}`, HARNESS_MODELS_TIMEOUT_MS);
}

export function run(payload: HarnessRunRequest): Promise<Response> {
  return harnessClient.post('/run', payload, HARNESS_RUN_TIMEOUT_MS);
}

export function runStream(payload: HarnessRunRequest): Promise<Response> {
  return harnessClient.post('/run/stream', payload, HARNESS_RUN_TIMEOUT_MS);
}

export function chat(payload: HarnessChatRequest): Promise<Response> {
  return harnessClient.post('/chat', payload, HARNESS_CHAT_TIMEOUT_MS);
}

export function code(payload: HarnessCodeRequest): Promise<Response> {
  return harnessClient.post('/code', payload, HARNESS_CHAT_TIMEOUT_MS);
}

export function listCodeConversations(orgId: number, limit = 50): Promise<Response> {
  return harnessClient.get(
    `/code/conversations?org_id=${orgId}&limit=${limit}`,
    HARNESS_CONVERSATIONS_TIMEOUT_MS,
  );
}

export function getCodeConversation(conversationId: number): Promise<Response> {
  return harnessClient.get(
    `/code/conversations/${conversationId}`,
    HARNESS_CONVERSATIONS_TIMEOUT_MS,
  );
}

export function getCodeConversationMessages(conversationId: number): Promise<Response> {
  return harnessClient.get(
    `/code/conversations/${conversationId}/messages`,
    HARNESS_CONVERSATIONS_TIMEOUT_MS,
  );
}

export function getCodeWorkspace(conversationId: number): Promise<Response> {
  return harnessClient.get(
    `/code/conversations/${conversationId}/workspace`,
    HARNESS_CONVERSATIONS_TIMEOUT_MS,
  );
}

export function updateCodeConversation(
  conversationId: number,
  body: { title?: string },
): Promise<Response> {
  return harnessClient.patch(
    `/code/conversations/${conversationId}`,
    body,
    HARNESS_CONVERSATIONS_TIMEOUT_MS,
  );
}

export function listAgents(orgId: number): Promise<Response> {
  return harnessClient.get(
    `/agents?org_id=${orgId}`,
    HARNESS_CONVERSATIONS_TIMEOUT_MS,
  );
}

export function listConversations(orgId: number, limit = 50): Promise<Response> {
  return harnessClient.get(
    `/conversations?org_id=${orgId}&limit=${limit}`,
    HARNESS_CONVERSATIONS_TIMEOUT_MS,
  );
}

export function getConversationMessages(conversationId: number): Promise<Response> {
  return harnessClient.get(
    `/conversations/${conversationId}/messages`,
    HARNESS_CONVERSATIONS_TIMEOUT_MS,
  );
}

export function getConversationSummary(conversationId: number): Promise<Response> {
  return harnessClient.get(
    `/conversations/${conversationId}/summary`,
    HARNESS_CONVERSATIONS_TIMEOUT_MS,
  );
}

export function updateConversation(
  conversationId: number,
  body: { title?: string },
): Promise<Response> {
  return harnessClient.patch(
    `/conversations/${conversationId}`,
    body,
    HARNESS_CONVERSATIONS_TIMEOUT_MS,
  );
}

// --- Enrichment / scheduler -------------------------------------------------

export function triggerScheduler(): Promise<Response> {
  return harnessClient.post('/scheduler/trigger', {}, HARNESS_SCHEDULER_TIMEOUT_MS);
}

export function reloadScheduler(): Promise<Response> {
  return harnessClient.post('/scheduler/reload', {}, HARNESS_SCHEDULER_TIMEOUT_MS);
}

export function getSchedulerStatus(): Promise<Response> {
  return harnessClient.get('/scheduler/status', HARNESS_SCHEDULER_TIMEOUT_MS);
}

export function getGraphCoverage(orgId: number): Promise<Response> {
  return harnessClient.get(
    `/graph/coverage?org_id=${orgId}`,
    HARNESS_ENRICHMENT_TIMEOUT_MS,
  );
}

export function listEnrichmentAgents(orgId: number): Promise<Response> {
  return harnessClient.get(`/enrichment/agents?org_id=${orgId}`, HARNESS_ENRICHMENT_TIMEOUT_MS);
}

export function createEnrichmentAgent(body: unknown): Promise<Response> {
  return harnessClient.post('/enrichment/agents', body, HARNESS_ENRICHMENT_TIMEOUT_MS);
}

export function patchEnrichmentAgent(id: number, body: unknown): Promise<Response> {
  return harnessClient.patch(`/enrichment/agents/${id}`, body, HARNESS_ENRICHMENT_TIMEOUT_MS);
}

export function triggerEnrichmentAgent(id: number): Promise<Response> {
  return harnessClient.post(`/enrichment/agents/${id}/trigger`, {}, HARNESS_SCHEDULER_TIMEOUT_MS);
}

export function getEnrichmentAgentStatus(id: number): Promise<Response> {
  return harnessClient.get(`/enrichment/agents/${id}/status`, HARNESS_SCHEDULER_TIMEOUT_MS);
}

// --- Enrichment sources ------------------------------------------------------

export function listEnrichmentSources(
  orgId: number,
  opts?: { agent_id?: number; active_only?: boolean },
): Promise<Response> {
  const params = new URLSearchParams({ org_id: String(orgId) });
  if (opts?.agent_id != null) params.set('agent_id', String(opts.agent_id));
  if (opts?.active_only != null) params.set('active_only', String(opts.active_only));
  return harnessClient.get(`/enrichment/sources?${params}`, HARNESS_ENRICHMENT_TIMEOUT_MS);
}

export function getEnrichmentSource(sourceId: number): Promise<Response> {
  return harnessClient.get(`/enrichment/sources/${sourceId}`, HARNESS_ENRICHMENT_TIMEOUT_MS);
}

export function createEnrichmentSource(body: unknown): Promise<Response> {
  return harnessClient.post('/enrichment/sources', body, HARNESS_ENRICHMENT_TIMEOUT_MS);
}

export function patchEnrichmentSource(sourceId: number, body: unknown): Promise<Response> {
  return harnessClient.patch(`/enrichment/sources/${sourceId}`, body, HARNESS_ENRICHMENT_TIMEOUT_MS);
}

export function deleteEnrichmentSource(sourceId: number): Promise<Response> {
  return harnessClient.delete(`/enrichment/sources/${sourceId}`, HARNESS_ENRICHMENT_TIMEOUT_MS);
}

export function flushEnrichmentSource(sourceId: number): Promise<Response> {
  return harnessClient.post(`/enrichment/sources/${sourceId}/flush`, {}, HARNESS_ENRICHMENT_TIMEOUT_MS);
}

export function getEnrichmentSourceLog(sourceId: number, limit = 50): Promise<Response> {
  return harnessClient.get(`/enrichment/sources/${sourceId}/log?limit=${limit}`, HARNESS_ENRICHMENT_TIMEOUT_MS);
}

// --- Enrichment log ----------------------------------------------------------

export function listEnrichmentLog(orgId: number, limit = 100): Promise<Response> {
  return harnessClient.get(`/enrichment/log?org_id=${orgId}&limit=${limit}`, HARNESS_ENRICHMENT_TIMEOUT_MS);
}

// --- Enrichment suggestions --------------------------------------------------

export function listEnrichmentSuggestions(orgId: number, status?: string): Promise<Response> {
  const params = new URLSearchParams({ org_id: String(orgId) });
  if (status) params.set('status', status);
  return harnessClient.get(`/enrichment/suggestions?${params}`, HARNESS_ENRICHMENT_TIMEOUT_MS);
}

export function getEnrichmentSuggestion(suggestionId: number): Promise<Response> {
  return harnessClient.get(`/enrichment/suggestions/${suggestionId}`, HARNESS_ENRICHMENT_TIMEOUT_MS);
}

export function patchEnrichmentSuggestion(suggestionId: number, body: unknown): Promise<Response> {
  return harnessClient.patch(`/enrichment/suggestions/${suggestionId}`, body, HARNESS_ENRICHMENT_TIMEOUT_MS);
}

export function approveEnrichmentSuggestion(suggestionId: number, body: unknown): Promise<Response> {
  return harnessClient.post(`/enrichment/suggestions/${suggestionId}/approve`, body, HARNESS_ENRICHMENT_TIMEOUT_MS);
}

export function rejectEnrichmentSuggestion(suggestionId: number): Promise<Response> {
  return harnessClient.post(`/enrichment/suggestions/${suggestionId}/reject`, {}, HARNESS_ENRICHMENT_TIMEOUT_MS);
}

// --- Stats / snapshots -------------------------------------------------------

export function getUsageStats(orgId: number, period: string): Promise<Response> {
  return harnessClient.get(`/stats/usage?org_id=${orgId}&period=${period}`, HARNESS_ENRICHMENT_TIMEOUT_MS);
}

export function getGraphSnapshot(orgId: number, limit = 20): Promise<Response> {
  return harnessClient.get(`/graph/snapshot?org_id=${orgId}&limit=${limit}`, HARNESS_ENRICHMENT_TIMEOUT_MS);
}

export function getChromaSnapshot(orgId: number): Promise<Response> {
  return harnessClient.get(`/chroma/snapshot?org_id=${orgId}`, HARNESS_ENRICHMENT_TIMEOUT_MS);
}

// --- Codebases ---------------------------------------------------------------

export function listCodebases(orgId: number): Promise<Response> {
  return harnessClient.get(`/codebases?org_id=${orgId}`, HARNESS_ENRICHMENT_TIMEOUT_MS);
}

export function createCodebase(body: unknown): Promise<Response> {
  return harnessClient.post('/codebases', body, HARNESS_ENRICHMENT_TIMEOUT_MS);
}

export function indexCodebase(id: number, body: unknown): Promise<Response> {
  return harnessClient.post(`/codebases/${id}/index`, body, HARNESS_RUN_TIMEOUT_MS);
}

export function listWorkerTypes(): Promise<Response> {
  return harnessClient.get('/workers/types', HARNESS_ENRICHMENT_TIMEOUT_MS);
}
