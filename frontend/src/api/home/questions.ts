// frontend/src/api/home/questions.ts
import { http } from '../../lib/http';
import { defaultOrgId } from './config';
import type { Question } from './types';

export function listQuestions(opts: {
  orgId?: number;
  status?: 'pending';
  limit?: number;
} = {}) {
  const orgId = opts.orgId ?? defaultOrgId();
  const status = opts.status ?? 'pending';
  const limit = opts.limit ?? 20;
  return http
    .get('home/questions', { searchParams: { org_id: orgId, status, limit } })
    .json<{ questions: Question[] }>();
}
