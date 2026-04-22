// frontend/src/features/hub/tabs/ops/lib/formatters.ts
import type { ChainKickResponse } from '../../../../../api/enrichment/chainKick';

export function asNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return null;
}

export function valueAt(row: Record<string, unknown>, key: string): unknown {
  return row[key];
}

export function fmt(v: unknown): string {
  if (v == null || v === '') return '-';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

export function fmtWhen(v?: string | null): string {
  if (!v) return '-';
  const t = Date.parse(v);
  if (Number.isNaN(t)) return v;
  return new Date(t).toLocaleString();
}

export function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

export function extractApiFailure(err: unknown): { message: string } {
  const fallback = { message: (err as Error)?.message ?? 'Request failed' };
  if (!err || typeof err !== 'object') return fallback;
  const maybeResp = err as { response?: Response };
  if (!(maybeResp.response instanceof Response)) return fallback;
  const r = maybeResp.response;
  return { message: `${r.status} ${r.statusText || 'Request failed'}` };
}

export function formatRelative(iso?: string | null): string {
  if (!iso) return '—';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  const diff = Date.now() - t;
  const future = diff < 0;
  const abs = Math.abs(diff);
  const sec = Math.round(abs / 1000);
  if (sec < 60) return future ? `in ${sec}s` : `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return future ? `in ${min}m` : `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 48) return future ? `in ${hr}h` : `${hr}h ago`;
  const day = Math.round(hr / 24);
  return future ? `in ${day}d` : `${day}d ago`;
}

export function formatKick(r: ChainKickResponse): string {
  switch (r.status) {
    case 'kicked':
      return `kicked (queued ${r.queued})`;
    case 'already_running':
      return `already running (inflight ${r.inflight})`;
    case 'disabled':
      return 'disabled';
    case 'no_queue':
      return 'no_queue';
    case 'failed':
      return r.error ? `failed (${r.error})` : 'failed';
  }
}

export function rowIdFromAny(row: Record<string, unknown>): string | null {
  const id = row.Id ?? row.id;
  if (id == null) return null;
  return String(id);
}
