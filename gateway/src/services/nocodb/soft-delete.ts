import { SOFT_DELETE_TABLES } from '../../constants/nocodb-tables.js';

const SOFT_FILTER = '(deleted_at,is,null)';

/**
 * Append the soft-delete filter to an optional `where` clause if the table supports it.
 * Returns `undefined` when there is nothing to filter (so callers can skip setting the param).
 */
export function withSoftDelete(tableName: string, where?: string): string | undefined {
  if (!SOFT_DELETE_TABLES.has(tableName)) return where || undefined;
  if (!where) return SOFT_FILTER;
  return `${where}~and${SOFT_FILTER}`;
}
