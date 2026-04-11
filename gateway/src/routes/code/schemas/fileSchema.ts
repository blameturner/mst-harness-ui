import { z } from 'zod';

export const fileSchema = z.object({
  name: z.string().min(1),
  content_b64: z.string(),
});
