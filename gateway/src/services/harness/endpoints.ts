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

export function listWorkerTypes(): Promise<Response> {
  return harnessClient.get('/workers/types', HARNESS_ENRICHMENT_TIMEOUT_MS);
}
