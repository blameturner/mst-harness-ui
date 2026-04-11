import { z } from 'zod';

export const patchCodeSchema = z.object({
  title: z.string().min(1).max(200).optional(),
});
