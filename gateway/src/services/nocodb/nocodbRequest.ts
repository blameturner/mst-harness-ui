import { NocoError } from '../../types/NocoError.js';
import { nocodbHeaders } from './nocodbHeaders.js';

// Single HTTP entrypoint for all Nocodb row operations. Routes never touch fetch directly —
// they go through listWhere/createRow/etc. in ./operations, which all funnel through here.
export async function nocodbRequest<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  url: string,
  body?: unknown,
  tableName?: string,
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: nocodbHeaders,
    body: body != null ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error(`[nocodb] ${method} ${tableName ?? url} failed`, res.status, detail);
    throw new NocoError(
      `Nocodb ${method} ${tableName ?? 'request'} failed: ${res.status}`,
      res.status,
      tableName,
    );
  }
  return (await res.json()) as T;
}
