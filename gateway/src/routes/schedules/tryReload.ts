import { FetchTimeoutError } from '../../lib/FetchTimeoutError.js';
import { reloadScheduler } from '../../services/harness/index.js';

export async function tryReload(): Promise<string | null> {
  try {
    const res = await reloadScheduler();
    if (!res.ok) return `harness /scheduler/reload returned ${res.status}`;
    return null;
  } catch (err) {
    if (err instanceof FetchTimeoutError) return 'scheduler reload timed out';
    console.error('[schedules] reload failed', err);
    return 'scheduler reload unreachable';
  }
}
