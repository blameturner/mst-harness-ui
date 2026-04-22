// frontend/src/api/home/feed.ts
import { http } from '../../lib/http';
import { defaultOrgId } from './config';
import type { FeedItem } from './types';

export function listHomeFeed(opts: { orgId?: number; limit?: number } = {}) {
  const orgId = opts.orgId ?? defaultOrgId();
  const limit = opts.limit ?? 25;
  return http
    .get('home/feed', { searchParams: { org_id: orgId, limit } })
    .json<{ items: FeedItem[] }>();
}
