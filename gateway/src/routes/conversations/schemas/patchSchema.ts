import { z } from 'zod';

export const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  contextual_grounding_enabled: z.boolean().optional(),
  deleted_at: z.string().datetime().optional(),
});
