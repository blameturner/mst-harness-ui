import { dataUrl } from '../dataUrl.js';
import { nocodbRequest as request } from '../nocodbRequest.js';
import { withSoftDelete } from '../soft-delete.js';
import type { NocoListResponse } from '../../../types/NocoListResponse.js';

export async function listWhere<T>(
  tableName: string,
  where?: string,
  limit = 100,
): Promise<T[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  const w = withSoftDelete(tableName, where);
  if (w) params.set('where', w);
  const body = await request<NocoListResponse<T>>(
    'GET',
    `${dataUrl(tableName)}?${params.toString()}`,
    undefined,
    tableName,
  );
  return body.list;
}
