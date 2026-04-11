import { dataUrl } from '../dataUrl.js';
import { nocodbRequest as request } from '../nocodbRequest.js';
import { withSoftDelete } from '../soft-delete.js';
import type { NocoListResponse } from '../../../types/NocoListResponse.js';

export async function countActive(tableName: string, where?: string): Promise<number> {
  const params = new URLSearchParams({ limit: '1' });
  const w = withSoftDelete(tableName, where);
  if (w) params.set('where', w);
  const body = await request<NocoListResponse<unknown>>(
    'GET',
    `${dataUrl(tableName)}?${params.toString()}`,
    undefined,
    tableName,
  );
  return body.pageInfo?.totalRows ?? 0;
}
