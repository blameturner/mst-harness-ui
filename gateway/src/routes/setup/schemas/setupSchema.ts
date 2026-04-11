import { z } from 'zod';

export const setupSchema = z.object({
  orgName: z.string().min(1),
  slug: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1),
});
