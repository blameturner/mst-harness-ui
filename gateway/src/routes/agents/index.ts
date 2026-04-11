import { Hono } from 'hono';
import { requireAuth } from '../../middleware/requireAuth.js';
import type { AuthVariables } from '../../types/AuthVariables.js';
import { listAgents } from './listAgents.js';
import { getAgent } from './getAgent.js';
import { listAgentRuns } from './listAgentRuns.js';
import { listAgentOutputs } from './listAgentOutputs.js';

export const agentsRoute = new Hono<{ Variables: AuthVariables }>();

agentsRoute.use('*', requireAuth);

agentsRoute.get('/', listAgents);
agentsRoute.get('/:id', getAgent);
agentsRoute.get('/:id/runs', listAgentRuns);
agentsRoute.get('/:id/outputs', listAgentOutputs);
