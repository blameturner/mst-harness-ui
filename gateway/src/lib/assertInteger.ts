export function assertInteger(value: unknown, label: string): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(n)) {
    throw new Error(`Invalid integer for ${label}`);
  }
  return n;
}
