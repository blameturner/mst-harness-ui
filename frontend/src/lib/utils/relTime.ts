export function relTime(value: string | number | null): string {
  if (value == null) return '—';
  let t: number;
  if (typeof value === 'number') {
    // Unix timestamp — could be seconds or milliseconds
    t = value < 1e12 ? value * 1000 : value;
  } else {
    // Numeric string (unix timestamp) vs ISO string
    const num = Number(value);
    if (!Number.isNaN(num) && /^\d+$/.test(value.trim())) {
      t = num < 1e12 ? num * 1000 : num;
    } else {
      t = new Date(value).getTime();
    }
  }
  if (Number.isNaN(t)) return String(value);
  const diff = Date.now() - t;
  if (diff < 0) {
    // Future date — show "in X"
    const s = Math.round(-diff / 1000);
    if (s < 60) return `in ${s}s`;
    const m = Math.round(s / 60);
    if (m < 60) return `in ${m}m`;
    const h = Math.round(m / 60);
    return `in ${h}h`;
  }
  const s = Math.round(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}
