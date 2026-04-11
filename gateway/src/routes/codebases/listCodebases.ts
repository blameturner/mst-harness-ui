import type { Context } from 'hono';
import { getAuthContext } from '../../lib/auth-context.js';
import { forwardResponse } from '../../lib/forwardResponse.js';
import { listCodebases as harnessListCodebases } from '../../services/harness/index.js';
import { mapCodebasesError } from './mapCodebasesError.js';

export async function listCodebases(c: Context) {
  const { orgId } = getAuthContext(c);
  try {
    const res = await harnessListCodebases(Number(orgId));
    return forwardResponse(res);
  } catch (err) {
    return mapCodebasesError(err);
  }
}
