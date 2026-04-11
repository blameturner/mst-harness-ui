import type { Context } from 'hono';
import { triggerScheduler } from '../../../services/harness/index.js';
import { forwardResponse } from '../../../lib/forwardResponse.js';
import { mapHarnessError } from '../../../lib/mapHarnessError.js';

export async function triggerSource(c: Context) {
  // Harness has no per-source trigger; fire a full scheduler cycle instead.
  try {
    const res = await triggerScheduler();
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'enrichment');
  }
}
