import { z } from 'zod';
import { categoryEnum } from '../constants/categoryEnum.js';

export const updateSourceSchema = z.object({
  name: z.string().min(1).optional(),
  url: z.string().url().optional(),
  category: categoryEnum.optional(),
  frequency_hours: z.number().int().positive().max(24 * 30).optional(),
  active: z.boolean().optional(),
  enrichment_agent_id: z.number().int().nullable().optional(),
  use_playwright: z.boolean().optional(),
  playwright_fallback: z.boolean().optional(),
});
