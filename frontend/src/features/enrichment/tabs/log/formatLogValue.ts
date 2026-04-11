// Pretty-print a python-dict-shaped log value by breaking each entry onto its own line.
// Not a real parser — just splits on top-level commas, which is fine because the harness
// only emits flat dicts here (no nested braces).

export function formatLogValue(value: string): string {
  if (value.startsWith('{') && value.endsWith('}')) {
    const inner = value.slice(1, -1).trim();
    if (!inner) return '{}';
    return inner.split(/,\s*/).join('\n');
  }
  return value;
}
