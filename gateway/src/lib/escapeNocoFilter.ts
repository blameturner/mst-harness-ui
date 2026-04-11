// NocoDB filter syntax uses `(field,op,value)` with `,`, `)`, `(`, `~` as
// structural characters. Any user-controlled string spliced into a filter must
// have those characters escaped or the attacker can break out of the clause.
// NocoDB supports backslash-escaping of these characters inside filter values.
export function escapeNocoFilter(value: string): string {
  return String(value).replace(/[\\(),~]/g, '\\$&');
}
