import { assertInteger } from './noco-filter.js';

export function parseIdParam(raw: string | undefined, field = 'id'): number | null {
  if (raw == null) return null;
  try {
    return assertInteger(raw, field);
  } catch {
    return null;
  }
}
