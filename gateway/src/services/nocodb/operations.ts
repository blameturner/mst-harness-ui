import { dataUrl, request } from './client.js';
import { withSoftDelete } from './soft-delete.js';
import type { NocoListResponse } from '../../types/nocodb.js';

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

/**
 * Count rows matching an optional where clause. Applies soft-delete filter automatically.
 */
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

export function createRow<T>(tableName: string, data: Record<string, unknown>): Promise<T> {
  return request<T>('POST', dataUrl(tableName), data, tableName);
}

export function patchRow<T>(
  tableName: string,
  rowId: string | number,
  data: Record<string, unknown>,
): Promise<T> {
  return request<T>('PATCH', dataUrl(tableName, rowId), data, tableName);
}
