import { http } from '../../lib/http';

export function listWorkerTypes() {
  return http
    .get('api/workers/types')
    .json<{ types: { id: string; name: string; description: string }[] }>();
}
