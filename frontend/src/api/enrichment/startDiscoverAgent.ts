import { http } from '../../lib/http';
import type { ChainKickResponse } from './chainKick';

export function startDiscoverAgent() {
  return http.post('api/enrichment/discover-agent/start').json<ChainKickResponse>();
}

