import { http } from '../../lib/http';

export function health() {
  return http.get('api/health').json<{ status: string; harness: string }>();
}
