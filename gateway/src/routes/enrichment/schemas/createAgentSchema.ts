import { z } from 'zod';

export const createAgentSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(''),
  category: z.string().default(''),
  token_budget: z.number().int().positive().default(50000),
  cron_expression: z.string().min(1),
  timezone: z.string().default('Australia/Sydney'),
  active: z.boolean().default(true),
});
