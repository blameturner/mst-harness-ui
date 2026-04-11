import { env } from '../../env.js';

export const nocodbHeaders: Readonly<Record<string, string>> = {
  'xc-token': env.NOCODB_TOKEN,
  'Content-Type': 'application/json',
};
