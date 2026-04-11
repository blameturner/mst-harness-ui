import { dataUrl } from '../dataUrl.js';
import { nocodbRequest as request } from '../nocodbRequest.js';

export function deleteRow(tableName: string, rowId: string | number): Promise<unknown> {
  return request<unknown>('DELETE', dataUrl(tableName, rowId), undefined, tableName);
}
