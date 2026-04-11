import { http } from '../../lib/http';

export function indexCodebase(id: number, files: Array<{ name: string; content: string }>) {
  return http
    .post(`api/codebases/${id}/index`, { json: { files } })
    .json<{ indexed: number }>();
}
