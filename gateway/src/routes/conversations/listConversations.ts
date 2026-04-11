import type { Context } from 'hono';
import { getAuthContext } from '../../lib/auth-context.js';
import { mapHarnessError } from '../../lib/mapHarnessError.js';
import { forwardResponse } from '../../lib/forwardResponse.js';
import { listConversations as harnessListConversations } from '../../services/harness/index.js';

export async function listConversations(c: Context) {
  const { orgId } = getAuthContext(c);
  try {
    const res = await harnessListConversations(Number(orgId));
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'conversations');
  }
}
