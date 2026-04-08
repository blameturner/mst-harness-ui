/**
 * NocoDB filter syntax uses `(field,op,value)` with `,`, `)`, `(`, `~` as
 * structural characters. Any user-controlled string spliced into a filter must
 * have those characters escaped or the attacker can break out of the clause.
 *
 * NocoDB supports backslash-escaping of these characters inside filter values.
 */
export function escapeNocoFilter(value: string): string {
  return String(value).replace(/[\\(),~]/g, '\\$&');
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function isValidEmail(v: unknown): v is string {
  return typeof v === 'string' && v.length <= 254 && EMAIL_RE.test(v);
}

export function assertInteger(value: unknown, label: string): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(n)) {
    throw new Error(`Invalid integer for ${label}`);
  }
  return n;
}
