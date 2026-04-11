import { http } from '../../lib/http';

export function setup(body: {
  orgName: string;
  slug: string;
  email: string;
  password: string;
  displayName: string;
}) {
  return http.post('api/setup', { json: body }).json<{ success: boolean }>();
}
