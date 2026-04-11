import { z } from 'zod';
import { CATEGORIES } from './CATEGORIES.js';

export const categoryEnum = z.enum(CATEGORIES);
