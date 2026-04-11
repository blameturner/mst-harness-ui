import { dataUrl } from '../dataUrl.js';
import { nocodbRequest as request } from '../nocodbRequest.js';

export function patchRow<T>(
  tableName: string,
  rowId: string | number,
  data: Record<string, unknown>,
): Promise<T> {
  return request<T>('PATCH', dataUrl(tableName, rowId), data, tableName);
}
