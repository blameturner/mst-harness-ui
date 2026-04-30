import { http } from '../../lib/http';
import { defaultOrgId } from '../home/config';

export interface MemoryCollection {
  name: string;
  chunk_count: number;
  freshness?: number[];
}
export interface MemorySearchHit {
  id: string;
  title?: string;
  text: string;
  url?: string;
  age_seconds?: number;
  collection: string;
  domain?: string;
  distance: number;
  neighbours?: Array<{ id: string; title?: string; text: string }>;
}
export interface MemoryHealth {
  ok: boolean;
  collections: number;
  chunks_total: number;
  last_index_at?: string;
  notes?: string[];
}
export interface MemoryCollectionStats {
  name: string;
  chunk_count: number;
  freshness?: number[];
  last_added?: string;
}

export interface MemorySearchBody {
  q: string;
  collections?: string[];
  domain?: string;
  max_age_days?: number;
  min_score?: number;
  limit?: number;
}

export interface MemoryAskSource {
  id: number;
  chunk_id?: string | null;
  collection: string;
  distance?: number;
  metadata?: Record<string, unknown>;
  snippet: string;
}
export interface MemoryAskResponse {
  query: string;
  answer: string;
  sources: MemoryAskSource[];
  collections_searched: string[];
}
export interface MemoryAskBody {
  query: string;
  collections?: string[];
  n_results?: number;
  max_tokens?: number;
}

export const memoryApi = {
  collections: () =>
    http
      .get('api/memory/collections', { searchParams: { org_id: defaultOrgId() } })
      .json<{ collections: MemoryCollection[] }>(),
  collectionStats: (name: string) =>
    http
      .get(`api/memory/collections/${encodeURIComponent(name)}/stats`, {
        searchParams: { org_id: defaultOrgId() },
      })
      .json<MemoryCollectionStats>(),
  search: (body: MemorySearchBody) =>
    http
      .post('api/memory/search', { json: { org_id: defaultOrgId(), ...body } })
      .json<{ hits: MemorySearchHit[] }>(),
  ask: (body: MemoryAskBody) =>
    http
      .post('api/memory/ask', { json: { org_id: defaultOrgId(), ...body } })
      .json<MemoryAskResponse>(),
  forget: (chunkId: string, collection: string) =>
    http
      .delete(`api/memory/items/${encodeURIComponent(chunkId)}`, {
        searchParams: { collection, org_id: defaultOrgId() },
      })
      .json<{ status: string; chunk_id: string; collection: string }>(),
  health: () =>
    http.get('api/memory/health', { searchParams: { org_id: defaultOrgId() } }).json<MemoryHealth>(),
};
