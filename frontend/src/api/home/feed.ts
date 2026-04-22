// frontend/src/api/home/feed.ts
import { http } from '../../lib/http';
import { defaultOrgId } from './config';
import type { FeedItem } from './types';

export function listHomeFeed(opts: { orgId?: number; limit?: number; before?: string } = {}) {
  const orgId = opts.orgId ?? defaultOrgId();
  const limit = opts.limit ?? 25;
  const searchParams: Record<string, string | number> = { org_id: orgId, limit };
  if (opts.before) searchParams.before = opts.before;
  return http
    .get('api/home/feed', { searchParams })
    .json<{ items: FeedItem[] }>();
}
