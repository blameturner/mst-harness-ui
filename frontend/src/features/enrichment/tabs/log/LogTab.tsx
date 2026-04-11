import { useEffect, useMemo, useState } from 'react';
import type { EnrichmentEventType } from '../../../../api/types/EnrichmentEventType';
import type { EnrichmentLogEntry } from '../../../../api/types/EnrichmentLogEntry';
import { ENRICHMENT_EVENT_TYPES } from '../../../../api/constants/ENRICHMENT_EVENT_TYPES';
import { listEnrichmentLog } from '../../../../api/enrichment/listEnrichmentLog';
import { LogRow } from './LogRow';

export function LogTab() {
  const [entries, setEntries] = useState<EnrichmentLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eventFilter, setEventFilter] = useState<EnrichmentEventType | ''>('');
  const [flagFilter, setFlagFilter] = useState('');

  useEffect(() => {
    setLoading(true);
    setError(null);
    listEnrichmentLog({ limit: 200 })
      .then((r) => setEntries(r.entries ?? []))
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const needle = flagFilter.trim().toLowerCase();
    return entries.filter((e) => {
      if (eventFilter && e.event_type !== eventFilter) return false;
      if (needle) {
        const hit = e.flags?.some((f) => f.toLowerCase().includes(needle));
        if (!hit) return false;
      }
      return true;
    });
  }, [entries, eventFilter, flagFilter]);

  const grouped = useMemo(() => {
    const groups = new Map<string, EnrichmentLogEntry[]>();
    for (const e of filtered) {
      const key = e.cycle_id || 'uncycled';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(e);
    }
    return Array.from(groups.entries());
  }, [filtered]);

  return (
    <div>
      <div className="bg-panel border border-border p-4 mb-4 flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-[0.16em] font-sans text-muted">
            event type
          </span>
          <select
            value={eventFilter}
            onChange={(e) => setEventFilter(e.target.value as EnrichmentEventType | '')}
            className="text-xs font-sans bg-bg border border-border px-2 py-1 text-fg"
          >
            <option value="">all</option>
            {ENRICHMENT_EVENT_TYPES.map((ev) => (
              <option key={ev} value={ev}>
                {ev}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-[0.16em] font-sans text-muted">
            flag contains
          </span>
          <input
            type="text"
            value={flagFilter}
            onChange={(e) => setFlagFilter(e.target.value)}
            placeholder="substring"
            className="text-xs font-sans bg-bg border border-border px-2 py-1 text-fg"
          />
        </label>
      </div>

      {error && <div className="text-xs font-sans text-red-700 mb-3">{error}</div>}
      {loading ? (
        <div className="text-sm text-muted">Loading…</div>
      ) : grouped.length === 0 ? (
        <div className="text-sm text-muted font-sans">No log entries.</div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([cycleId, rows]) => {
            const tokens = rows.reduce((a, r) => a + (r.tokens_used ?? 0), 0);
            const counts: Record<string, number> = {};
            for (const r of rows) counts[r.event_type] = (counts[r.event_type] ?? 0) + 1;
            return (
              <div key={cycleId}>
                <div className="border-b border-fg pb-2 mb-2 flex justify-between items-baseline">
                  <span className="font-sans text-xs text-fg">cycle {cycleId}</span>
                  <span className="text-[10px] uppercase tracking-[0.14em] font-sans text-muted">
                    {tokens.toLocaleString()} tokens ·{' '}
                    {Object.entries(counts)
                      .map(([k, v]) => `${k}:${v}`)
                      .join(' · ')}
                  </span>
                </div>
                <div className="divide-y divide-border">
                  {rows.map((r) => (
                    <LogRow key={r.id} row={r} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6 text-[10px] uppercase tracking-[0.14em] font-sans text-muted">
        {filtered.length} entries
        {(eventFilter || flagFilter) && ` (${entries.length} total)`}
      </div>
    </div>
  );
}
