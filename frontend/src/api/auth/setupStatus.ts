import { http } from '../../lib/http';

export function setupStatus() {
  return http.get('api/setup/status').json<{ configured: boolean }>();
}
