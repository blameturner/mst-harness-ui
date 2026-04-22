// frontend/src/api/home/mutations.ts
import { http, HTTPError } from '../../lib/http';
import { defaultOrgId } from './config';

export interface JobResponse {
  job_id: string;
}

export interface QueuedResponse {
  status: 'queued';
  tool_job_id: string;
}

export async function runDigest(orgId: number = defaultOrgId()): Promise<QueuedResponse> {
  return http.post('api/home/digest/run', { json: { org_id: orgId } }).json<QueuedResponse>();
}

export type FeedbackSignal = 'up' | 'down';

export async function postDigestFeedback(args: {
  digestId: number;
  signal: FeedbackSignal;
  domain?: string;
  note?: string;
  orgId?: number;
}): Promise<{ ok: boolean; notConfigured?: boolean; id?: number }> {
  try {
    const json = await http
      .post(`api/home/digest/${args.digestId}/feedback`, {
        json: {
          org_id: args.orgId ?? defaultOrgId(),
          signal: args.signal,
          domain: args.domain ?? '',
          note: args.note ?? '',
        },
      })
      .json<{ status: 'ok'; id: number }>();
    return { ok: true, id: json.id };
  } catch (err) {
    if (err instanceof HTTPError && err.response.status === 503) {
      return { ok: false, notConfigured: true };
    }
    throw err;
  }
}

export async function produceInsight(opts: {
  orgId?: number;
  topicHint?: string | null;
} = {}): Promise<QueuedResponse> {
  return http
    .post('api/home/insights/produce', {
      json: {
        org_id: opts.orgId ?? defaultOrgId(),
        topic_hint: opts.topicHint ?? null,
      },
    })
    .json<QueuedResponse>();
}

export async function answerQuestion(args: {
  id: number;
  selectedOption: string;
  answerText: string;
  orgId?: number;
}): Promise<JobResponse> {
  return http
    .post(`api/home/questions/${args.id}/answer`, {
      json: {
        org_id: args.orgId ?? defaultOrgId(),
        selected_option: args.selectedOption,
        answer_text: args.answerText,
        model: 'chat',
        response_style: null,
      },
    })
    .json<JobResponse>();
}

export async function dismissQuestion(args: {
  id: number;
  reason?: string;
  orgId?: number;
}): Promise<{ status: 'dismissed' }> {
  return http
    .post(`api/home/questions/${args.id}/dismiss`, {
      json: { org_id: args.orgId ?? defaultOrgId(), reason: args.reason ?? '' },
    })
    .json<{ status: 'dismissed' }>();
}

export async function retractQuestion(args: {
  id: number;
  orgId?: number;
}): Promise<{ status: 'pending' }> {
  return http
    .post(`api/home/questions/${args.id}/retract`, {
      json: { org_id: args.orgId ?? defaultOrgId() },
    })
    .json<{ status: 'pending' }>();
}

export async function sendHomeChat(args: {
  message: string;
  orgId?: number;
  searchMode?: 'disabled' | 'basic' | 'standard';
  searchConsentConfirmed?: boolean;
}): Promise<JobResponse> {
  return http
    .post('api/home/chat', {
      json: {
        org_id: args.orgId ?? defaultOrgId(),
        model: 'chat',
        message: args.message,
        response_style: null,
        search_mode: args.searchMode ?? 'basic',
        search_consent_confirmed: args.searchConsentConfirmed ?? false,
        temperature: null,
        max_tokens: null,
      },
    })
    .json<JobResponse>();
}

export async function runBriefing(orgId: number = defaultOrgId()): Promise<JobResponse> {
  return http
    .post('api/home/briefing', { searchParams: { org_id: orgId } })
    .json<JobResponse>();
}

export async function runSchedule(args: {
  id: number;
  task?: string | null;
  product?: string | null;
}): Promise<{ status: 'dispatched'; agent_name: string; org_id: number }> {
  return http
    .post(`api/home/schedules/${args.id}/run-now`, {
      json: { task: args.task ?? null, product: args.product ?? null },
    })
    .json<{ status: 'dispatched'; agent_name: string; org_id: number }>();
}

export function isRateLimited(err: unknown): boolean {
  return err instanceof HTTPError && err.response.status === 429;
}
