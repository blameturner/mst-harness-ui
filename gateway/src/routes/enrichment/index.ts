import { Hono } from 'hono';
import { requireAuth } from '../../middleware/requireAuth.js';
import { getAuthContext } from '../../lib/auth-context.js';
import { mapHarnessError } from '../../lib/mapHarnessError.js';
import { forwardResponse } from '../../lib/forwardResponse.js';
import { harnessClient } from '../../services/harness/client.js';
import type { AuthVariables } from '../../types/AuthVariables.js';
import { listSources } from './sources/listSources.js';
import { getSource } from './sources/getSource.js';
import { createSource } from './sources/createSource.js';
import { patchSource } from './sources/patchSource.js';
import { deleteSource } from './sources/deleteSource.js';
import { triggerSource } from './sources/triggerSource.js';
import { flushSource } from './sources/flushSource.js';
import { getSourceLog } from './sources/getSourceLog.js';
import { listLog } from './log/listLog.js';
import { listSuggestions } from './suggestions/listSuggestions.js';
import { approveByParent } from './suggestions/approveByParent.js';
import { rejectByParent } from './suggestions/rejectByParent.js';
import { getSuggestion } from './suggestions/getSuggestion.js';
import { patchSuggestion } from './suggestions/patchSuggestion.js';
import { approveSuggestion } from './suggestions/approveSuggestion.js';
import { rejectSuggestion } from './suggestions/rejectSuggestion.js';
import { getStatus } from './scheduler/getStatus.js';
import { triggerCycle } from './scheduler/triggerCycle.js';
import { listAgents } from './agents/listAgents.js';
import { createAgent } from './agents/createAgent.js';
import { patchAgent } from './agents/patchAgent.js';
import { triggerAgent } from './agents/triggerAgent.js';
import { getAgentStatus } from './agents/getAgentStatus.js';

export const enrichmentRoute = new Hono<{ Variables: AuthVariables }>();

enrichmentRoute.use('*', requireAuth);

enrichmentRoute.get('/sources', listSources);
enrichmentRoute.get('/sources/:id', getSource);
enrichmentRoute.post('/sources', createSource);
enrichmentRoute.patch('/sources/:id', patchSource);
enrichmentRoute.delete('/sources/:id', deleteSource);
enrichmentRoute.post('/sources/:id/trigger', triggerSource);
enrichmentRoute.post('/sources/:id/flush', flushSource);
enrichmentRoute.get('/sources/:id/log', getSourceLog);

enrichmentRoute.get('/log', listLog);

enrichmentRoute.get('/suggestions', listSuggestions);
enrichmentRoute.post('/suggestions/approve-by-parent', approveByParent);
enrichmentRoute.post('/suggestions/reject-by-parent', rejectByParent);
enrichmentRoute.get('/suggestions/:id', getSuggestion);
enrichmentRoute.patch('/suggestions/:id', patchSuggestion);
enrichmentRoute.post('/suggestions/:id/approve', approveSuggestion);
enrichmentRoute.post('/suggestions/:id/reject', rejectSuggestion);

enrichmentRoute.get('/status', getStatus);
enrichmentRoute.post('/trigger', triggerCycle);

enrichmentRoute.get('/agents', listAgents);
enrichmentRoute.post('/agents', createAgent);
enrichmentRoute.patch('/agents/:id', patchAgent);
enrichmentRoute.post('/agents/:id/trigger', triggerAgent);
enrichmentRoute.get('/agents/:id/status', getAgentStatus);

enrichmentRoute.get('/scrape-report', async (c) => {
  const { orgId } = getAuthContext(c);
  try {
    const res = await harnessClient.get(`/enrichment/scrape-report?org_id=${Number(orgId)}`, 15_000);
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'enrichment');
  }
});
