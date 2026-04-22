// frontend/src/api/home/digest.ts
import { http, HTTPError } from '../../lib/http';
import { defaultOrgId } from './config';
import type { DigestMeta } from './types';

export async function getDigest(opts: { orgId?: number; date?: string } = {}) {
  const orgId = opts.orgId ?? defaultOrgId();
  const search: Record<string, string | number> = { org_id: orgId };
  if (opts.date) search.date = opts.date;
  try {
    return await http.get('home/digest', { searchParams: search }).json<DigestMeta>();
  } catch (err) {
    if (err instanceof HTTPError && err.response.status === 404) return null;
    throw err;
  }
}

export function listDigests(opts: { orgId?: number; limit?: number } = {}) {
  const orgId = opts.orgId ?? defaultOrgId();
  const limit = opts.limit ?? 7;
  return http
    .get('home/digests', { searchParams: { org_id: orgId, limit } })
    .json<{ digests: DigestMeta[] }>();
}
