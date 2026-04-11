import { env } from '../../env.js';
import { nocodbTableIds } from './nocodbTableIds.js';

export function dataUrl(tableName: string, rowId?: string | number): string {
  const id = nocodbTableIds.map[tableName];
  if (!id) throw new Error(`Nocodb table not found: ${tableName}`);
  const base = `${env.NOCODB_URL}/api/v1/db/data/noco/${env.NOCODB_BASE_ID}/${id}`;
  return rowId != null ? `${base}/${rowId}` : base;
}
