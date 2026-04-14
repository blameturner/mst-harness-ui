import { dataUrl } from '../dataUrl.js';
import { nocodbRequest as request } from '../nocodbRequest.js';
import { withSoftDelete } from '../soft-delete.js';
import type { NocoListResponse } from '../../../types/NocoListResponse.js';

// Extended list with pagination + sorting. Returns the full NocoListResponse
// (list + pageInfo) for callers that need `offset` and `sort` (not exposed by
// listWhere). `sort` uses Nocodb's comma-separated field list; prefix a field
// with `-` for descending.
export async function listPage<T>(
  tableName: string,
  options: { where?: string; limit?: number; offset?: number; sort?: string } = {},
): Promise<NocoListResponse<T>> {
  const { where, limit = 50, offset = 0, sort } = options;
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  const w = withSoftDelete(tableName, where);
  if (w) params.set('where', w);
  if (sort) params.set('sort', sort);
  return request<NocoListResponse<T>>(
    'GET',
    `${dataUrl(tableName)}?${params.toString()}`,
    undefined,
    tableName,
  );
}
