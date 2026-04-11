import { z } from 'zod';
import { fileSchema } from './fileSchema.js';

export const codeSchema = z.object({
  model: z.string().min(1),
  message: z.string().min(1),
  mode: z.enum(['plan', 'execute', 'debug']),
  approved_plan: z.string().optional().nullable(),
  files: z.array(fileSchema).optional(),
  conversation_id: z.number().int().positive().optional().nullable(),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().positive().optional(),
  codebase_collection: z.string().optional().nullable(),
  response_style: z.string().optional(),
});
