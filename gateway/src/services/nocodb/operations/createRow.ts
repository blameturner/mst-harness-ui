import { dataUrl } from '../dataUrl.js';
import { nocodbRequest as request } from '../nocodbRequest.js';

export function createRow<T>(tableName: string, data: Record<string, unknown>): Promise<T> {
  return request<T>('POST', dataUrl(tableName), data, tableName);
}
