import { http } from '../../lib/http';

export function orgMe() {
  return http.get('api/org/me').json<{ org: any; user: any }>();
}
