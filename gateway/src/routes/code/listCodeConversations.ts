import type { Context } from 'hono';
import { getAuthContext } from '../../lib/auth-context.js';
import { mapHarnessError } from '../../lib/mapHarnessError.js';
import { forwardResponse } from '../../lib/forwardResponse.js';
import { listCodeConversations as harnessListCodeConversations } from '../../services/harness/index.js';

export async function listCodeConversations(c: Context) {
  const { orgId } = getAuthContext(c);
  try {
    const res = await harnessListCodeConversations(Number(orgId));
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'code');
  }
}
