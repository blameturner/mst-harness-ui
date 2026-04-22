// frontend/src/api/home/search.ts
import { http } from '../../lib/http';
import { defaultOrgId } from './config';

export interface HomeSearchHit {
  text: string;
  metadata: Record<string, unknown> & {
    source?: string;
    kind?: string;
    chunk_index?: number;
  };
  distance: number;
}

export function searchHome(opts: {
  query: string;
  orgId?: number;
  collection?: 'agent_outputs' | 'daily_digests' | 'chat_knowledge';
  nResults?: number;
}) {
  return http
    .post('api/home/search', {
      json: {
        org_id: opts.orgId ?? defaultOrgId(),
        query: opts.query,
        collection: opts.collection ?? 'agent_outputs',
        n_results: opts.nResults ?? 8,
      },
    })
    .json<{ query: string; collection: string; hits: HomeSearchHit[] }>();
}
