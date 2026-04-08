import { env } from '../../env.js';
import { NocoError, type NocoTablesResponse } from '../../types/nocodb.js';

const HEADERS: Readonly<Record<string, string>> = {
  'xc-token': env.NOCODB_TOKEN,
  'Content-Type': 'application/json',
};

type TableMap = Record<string, string>;
let tableIds: TableMap = {};

/**
 * Discover Nocodb table IDs by name, with retry. Called once at boot.
 * This is the one place retries live — runtime queries fail fast.
 */
export async function initNocodbTables(): Promise<TableMap> {
  const url = `${env.NOCODB_URL}/api/v1/db/meta/projects/${env.NOCODB_BASE_ID}/tables`;
  const maxAttempts = 15; // 15 × 2s = 30s
  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, { headers: HEADERS });
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        console.error('[nocodb] table discovery failed', res.status, detail);
        throw new Error(`Nocodb table discovery HTTP ${res.status}`);
      }
      const body = (await res.json()) as NocoTablesResponse;
      tableIds = Object.fromEntries(body.list.map((t) => [t.title, t.id]));
      console.log('[nocodb] discovered tables:', Object.keys(tableIds).join(', '));
      return tableIds;
    } catch (err) {
      lastErr = err;
      console.log(`[nocodb] not ready, retrying… (${attempt}/${maxAttempts})`);
      if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error(
    `Could not connect to Nocodb after ${maxAttempts * 2} seconds: ${String(lastErr)}`,
  );
}

function tableId(name: string): string {
  const id = tableIds[name];
  if (!id) throw new Error(`Nocodb table not found: ${name}`);
  return id;
}

export function dataUrl(tableName: string, rowId?: string | number): string {
  const base = `${env.NOCODB_URL}/api/v1/db/data/noco/${env.NOCODB_BASE_ID}/${tableId(tableName)}`;
  return rowId != null ? `${base}/${rowId}` : base;
}

/**
 * Single HTTP entrypoint for all Nocodb row operations. Routes never touch fetch directly —
 * they go through `listWhere`/`createRow`/etc. in `./operations.ts`, which go through here.
 */
export async function request<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  url: string,
  body?: unknown,
  tableName?: string,
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: HEADERS,
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
