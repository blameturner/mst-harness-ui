import { gatewayUrl } from '../../lib/runtime-env';

export function getLogStreamUrl(params?: { since?: number; tail?: number }): string {
  const sp = new URLSearchParams();
  if (params?.since != null) sp.set('since', String(params.since));
  if (params?.tail != null) sp.set('tail', String(params.tail));
  const qs = sp.toString();
  return `${gatewayUrl()}/api/logs/stream${qs ? `?${qs}` : ''}`;
}
