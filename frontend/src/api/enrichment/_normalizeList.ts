export interface NormalizedList<T> {
  items: T[];
  total: number;
}

/**
 * Accept either `{ items, total }` or `{ status, rows }` list shapes and return
 * a normalized `{ items, total }`. Logs once per shape-drift event so we notice
 * the backend changed without breaking the UI.
 */
export function normalizeList<T>(raw: unknown, context: string): NormalizedList<T> {
  if (Array.isArray(raw)) {
    warnOnce(context, 'array', `backend returned a raw array; normalizing to {items}.`);
    return { items: raw as T[], total: raw.length };
  }
  if (raw && typeof raw === 'object') {
    const r = raw as Record<string, unknown>;
    if (Array.isArray(r.items)) {
      return { items: r.items as T[], total: typeof r.total === 'number' ? r.total : r.items.length };
    }
    for (const key of ['rows', 'data', 'plans', 'results']) {
      const v = r[key];
      if (Array.isArray(v)) {
        warnOnce(context, key, `backend returned {${key}} shape; normalizing to {items}.`);
        return { items: v as T[], total: typeof r.total === 'number' ? r.total : v.length };
      }
    }
    warnOnce(
      context,
      'unknown',
      `no recognised list field found. Top-level keys: [${Object.keys(r).join(', ')}]. Raw response:`,
      raw,
    );
  } else {
    warnOnce(context, 'non-object', `expected object or array, got ${typeof raw}. Raw:`, raw);
  }
  return { items: [], total: 0 };
}

function warnOnce(context: string, key: string, message: string, extra?: unknown) {
  if (typeof window === 'undefined') return;
  const store = ((window as unknown as { __shapeDriftWarned?: Record<string, Set<string>> }).__shapeDriftWarned ??= {});
  const seen = (store[context] ??= new Set<string>());
  if (seen.has(key)) return;
  seen.add(key);
  // eslint-disable-next-line no-console
  if (extra !== undefined) console.warn(`[api] ${context}: ${message}`, extra);
  // eslint-disable-next-line no-console
  else console.warn(`[api] ${context}: ${message}`);
}
