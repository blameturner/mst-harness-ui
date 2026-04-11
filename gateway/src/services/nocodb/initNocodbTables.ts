import { env } from '../../env.js';
import type { NocoTablesResponse } from '../../types/NocoTablesResponse.js';
import { nocodbHeaders } from './nocodbHeaders.js';
import { nocodbTableIds } from './nocodbTableIds.js';

// Discover Nocodb table IDs by name. Called once at boot with retry — runtime
// queries fail fast since the gateway can't function without the table map.
export async function initNocodbTables(): Promise<Record<string, string>> {
  const url = `${env.NOCODB_URL}/api/v1/db/meta/projects/${env.NOCODB_BASE_ID}/tables`;
  const maxAttempts = 15;
  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, { headers: nocodbHeaders });
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        console.error('[nocodb] table discovery failed', res.status, detail);
        throw new Error(`Nocodb table discovery HTTP ${res.status}`);
      }
      const body = (await res.json()) as NocoTablesResponse;
      nocodbTableIds.map = Object.fromEntries(body.list.map((t) => [t.title, t.id]));
      console.log('[nocodb] discovered tables:', Object.keys(nocodbTableIds.map).join(', '));
      return nocodbTableIds.map;
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
