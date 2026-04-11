import { http } from '../../lib/http';
import type { ScrapeTarget } from '../types/ScrapeTarget';

export function listEnrichmentSources(params?: { agent_id?: number; active_only?: boolean }) {
  const searchParams: Record<string, string> = {};
  if (params?.agent_id != null) searchParams.agent_id = String(params.agent_id);
  if (params?.active_only != null) searchParams.active_only = String(params.active_only);
  return http
    .get('api/enrichment/sources', { searchParams })
    .json<{ sources: ScrapeTarget[] }>();
}
