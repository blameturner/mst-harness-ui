import { Hono } from 'hono';
import { requireAuth } from '../middleware/requireAuth.js';
import { getAuthContext } from '../lib/auth-context.js';
import { mapHarnessError } from '../lib/mapHarnessError.js';
import { forwardResponse } from '../lib/forwardResponse.js';
import type { AuthVariables } from '../types/AuthVariables.js';
import { harnessClient } from '../services/harness/client.js';

const TIMEOUT = 15_000;

export const messagesRoute = new Hono<{ Variables: AuthVariables }>();

messagesRoute.use('*', requireAuth);

messagesRoute.get('/:id/search-sources', async (c) => {
  const id = c.req.param('id');
  const { orgId } = getAuthContext(c);
  try {
    const res = await harnessClient.get(
      `/messages/${encodeURIComponent(id)}/search-sources?org_id=${Number(orgId)}`,
      TIMEOUT,
    );
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'messages');
  }
});
