import { z } from 'zod';
import { isValidCron } from '../isValidCron.js';
import { isValidTimezone } from '../isValidTimezone.js';

export const scheduleSchema = z.object({
  agent_name: z.string().min(1),
  cron_expression: z
    .string()
    .refine(isValidCron, 'cron_expression must be standard 5-field cron (no seconds, no aliases)'),
  timezone: z
    .string()
    .default('Australia/Sydney')
    .refine(isValidTimezone, 'timezone must be a valid IANA identifier (e.g. Australia/Sydney)'),
  task_description: z.string().min(1),
  product: z.string().default(''),
  active: z.boolean().default(true),
});
