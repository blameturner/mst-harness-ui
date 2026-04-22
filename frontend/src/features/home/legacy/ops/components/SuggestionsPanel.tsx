import { useEffect, useMemo, useState } from 'react';
import {
  approveSuggestion,
  listSuggestions,
  pathfinderDiscover,
  rejectSuggestion,
} from '../../../../../api/enrichment/suggestions';
import type {
  Suggestion,
  SuggestionRelevance,
  SuggestionStatus,
} from '../../../../../api/types/Suggestion';
import { extractApiFailure } from '../lib/formatters';
import { RelativeTime } from './RelativeTime';

type StatusTab = SuggestionStatus | 'all';

const STATUS_TABS: ReadonlyArray<{ id: StatusTab; label: string }> = [
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'extracted', label: 'Extracted' },
  { id: 'failed', label: 'Failed' },
  { id: 'all', label: 'All' },
];

const RELEVANCE_STYLE: Record<SuggestionRelevance, string> = {
  high: 'bg-emerald-500/20 text-emerald-300',
  medium: 'bg-blue-500/20 text-blue-300',
  low: 'bg-panel text-muted',
  rejected: 'bg-red-500/20 text-red-400',
};

export interface SuggestionsPanelProps {
  orgId: number | null;
  onActionComplete: () => void;
  loading?: boolean;
}

export function SuggestionsPanel({ orgId, onActionComplete, loading }: SuggestionsPanelProps) {
  const [tab, setTab] = useState<StatusTab>('pending');
  const [rows, setRows] = useState<Suggestion[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [listing, setListing] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busyId, setBusyId] = useState<number | null>(null);
  const [bulkBusy, setBulkBusy] = useState<{ done: number; total: number } | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<Record<number, string>>({});
  const [seedUrl, setSeedUrl] = useState('');
  const [seedBusy, setSeedBusy] = useState(false);

  const counts = useMemo(() => countByStatus(rows), [rows]);

  useEffect(() => {
    if (orgId == null) return;
    let cancelled = false;
    setListing(true);
    setListError(null);
    const status = tab === 'all' ? '' : tab;
    listSuggestions({ org_id: orgId, status, limit: 50 })
      .then((res) => {
        if (cancelled) return;
        if (res.status === 'ok') {
          setRows(res.rows);
        } else {
          setListError(res.error ?? 'failed to load suggestions');
          setRows([]);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setListError(extractApiFailure(err).message);
      })
      .finally(() => {
        if (!cancelled) setListing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [orgId, tab]);

  function flashMessage(msg: string) {
    setActionMessage(msg);
    window.setTimeout(() => setActionMessage(null), 6000);
  }

  function removeLocally(id: number) {
    setRows((prev) => prev.filter((r) => r.Id !== id));
    setSelected((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  async function handleApprove(id: number) {
    setBusyId(id);
    try {
      const res = await approveSuggestion(id);
      if (res.status === 'queued') {
        removeLocally(id);
        flashMessage(`approved & queued job ${res.job_id ?? '?'}`);
        onActionComplete();
      } else {
        flashMessage(`approve ${res.status}: ${res.error ?? ''}`);
      }
    } catch (err) {
      flashMessage(`approve error: ${extractApiFailure(err).message}`);
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(id: number) {
    setBusyId(id);
    try {
      const reason = rejectReason[id]?.trim() || undefined;
      const res = await rejectSuggestion(id, reason);
      if (res.status === 'ok') {
        removeLocally(id);
        flashMessage(`rejected ${id}`);
        onActionComplete();
      } else {
        flashMessage(`reject ${res.status}: ${res.error ?? ''}`);
      }
    } catch (err) {
      flashMessage(`reject error: ${extractApiFailure(err).message}`);
    } finally {
      setBusyId(null);
    }
  }

  async function handleBulk(action: 'approve' | 'reject') {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setBulkBusy({ done: 0, total: ids.length });
    let done = 0;
    for (const id of ids) {
      try {
        if (action === 'approve') {
          const res = await approveSuggestion(id);
          if (res.status === 'queued') removeLocally(id);
        } else {
          const res = await rejectSuggestion(id);
          if (res.status === 'ok') removeLocally(id);
        }
      } catch {
        // Continue on error; bulk surfaces aggregate result only.
      }
      done += 1;
      setBulkBusy({ done, total: ids.length });
    }
    setBulkBusy(null);
    flashMessage(`${action}d ${done}/${ids.length}`);
    onActionComplete();
  }

  async function handleManualSeed(e: React.FormEvent) {
    e.preventDefault();
    const url = seedUrl.trim();
    if (!url || orgId == null) return;
    setSeedBusy(true);
    try {
      const res = await pathfinderDiscover(url, orgId);
      if (res.status === 'queued') {
        flashMessage('seed queued — extracting links in background, refresh in a minute');
        setSeedUrl('');
        onActionComplete();
      } else {
        flashMessage(`seed failed: ${res.error ?? 'unknown'}`);
      }
    } catch (err) {
      flashMessage(`seed error: ${extractApiFailure(err).message}`);
    } finally {
      setSeedBusy(false);
    }
  }

  const visibleRows = rows;
  const isLoading = loading || listing;
  const allSelected = visibleRows.length > 0 && visibleRows.every((r) => selected.has(r.Id));

  function toggleAll() {
    setSelected(() => {
      if (allSelected) return new Set();
      return new Set(visibleRows.map((r) => r.Id));
    });
  }

  function toggleOne(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      <form
        onSubmit={handleManualSeed}
        className="flex items-end gap-2 border border-border rounded p-3"
      >
        <div className="flex-1">
          <label className="block text-[10px] uppercase tracking-[0.14em] text-muted mb-1">
            Add seed URL
          </label>
          <input
            type="url"
            required
            value={seedUrl}
            onChange={(e) => setSeedUrl(e.target.value)}
            placeholder="https://example.com/article"
            className="w-full px-3 py-2 rounded border border-border bg-panel text-fg text-sm font-sans focus:outline-none focus:border-fg"
          />
        </div>
        <button
          type="submit"
          disabled={!seedUrl.trim() || orgId == null || seedBusy}
          className="px-3 py-2 rounded border border-border text-[11px] uppercase tracking-[0.14em] hover:bg-panel disabled:opacity-50"
        >
          {seedBusy ? 'Queueing…' : 'Seed pathfinder'}
        </button>
      </form>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <nav className="flex gap-1">
          {STATUS_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={[
                'px-2.5 py-1 rounded border text-[10px] uppercase tracking-[0.14em]',
                tab === t.id ? 'border-fg text-fg' : 'border-border text-muted hover:text-fg',
              ].join(' ')}
            >
              {t.label}
              <span className="ml-1.5 tabular-nums text-muted">
                {t.id === 'all' ? rows.length : counts[t.id] ?? 0}
              </span>
            </button>
          ))}
        </nav>
        {actionMessage && (
          <span className="text-[11px] uppercase tracking-[0.14em] text-muted">
            {actionMessage}
          </span>
        )}
      </div>

      {tab === 'pending' && visibleRows.length > 0 && (
        <div className="flex items-center gap-2 text-[11px]">
          <button
            type="button"
            onClick={toggleAll}
            className="px-2 py-1 rounded border border-border text-[10px] uppercase tracking-[0.12em] hover:bg-panel"
          >
            {allSelected ? 'Clear selection' : 'Select all'}
          </button>
          <button
            type="button"
            disabled={selected.size === 0 || bulkBusy != null}
            onClick={() => void handleBulk('approve')}
            className="px-2 py-1 rounded border border-emerald-500/40 text-emerald-400 text-[10px] uppercase tracking-[0.12em] hover:bg-emerald-500/10 disabled:opacity-50"
          >
            Approve selected ({selected.size})
          </button>
          <button
            type="button"
            disabled={selected.size === 0 || bulkBusy != null}
            onClick={() => void handleBulk('reject')}
            className="px-2 py-1 rounded border border-border text-[10px] uppercase tracking-[0.12em] hover:bg-panel disabled:opacity-50"
          >
            Reject selected ({selected.size})
          </button>
          {bulkBusy && (
            <span className="text-muted text-[11px]">
              {bulkBusy.done}/{bulkBusy.total}
            </span>
          )}
        </div>
      )}

      {listError && <p className="text-xs text-red-400">{listError}</p>}

      <div className="overflow-x-auto border border-border rounded">
        <table className="w-full text-sm font-sans">
          <thead className="bg-panel/50 text-[10px] uppercase tracking-[0.14em] text-muted">
            <tr>
              <th className="px-2 py-2 w-8">
                {tab === 'pending' && visibleRows.length > 0 && (
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Select all"
                  />
                )}
              </th>
              <th className="px-3 py-2 text-left">Title / URL</th>
              <th className="px-3 py-2 text-left">Query</th>
              <th className="px-3 py-2 text-left">Relevance</th>
              <th className="px-3 py-2 text-left">Score</th>
              <th className="px-3 py-2 text-left">Reason</th>
              <th className="px-3 py-2 text-left">Age</th>
              <th className="px-3 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visibleRows.map((s) => (
              <tr key={s.Id} className="hover:bg-panel/30 align-top">
                <td className="px-2 py-2">
                  {tab === 'pending' && (
                    <input
                      type="checkbox"
                      checked={selected.has(s.Id)}
                      onChange={() => toggleOne(s.Id)}
                      aria-label={`Select ${s.Id}`}
                    />
                  )}
                </td>
                <td className="px-3 py-2 max-w-[22rem]">
                  <div className="truncate font-medium">{s.title ?? '(untitled)'}</div>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="block text-[11px] text-muted hover:underline truncate"
                    title={s.url}
                  >
                    {s.url}
                  </a>
                </td>
                <td className="px-3 py-2 text-muted max-w-[14rem] truncate" title={s.query ?? ''}>
                  {s.query ?? '-'}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={[
                      'inline-block px-2 py-0.5 rounded text-[10px] uppercase tracking-[0.1em]',
                      RELEVANCE_STYLE[s.relevance],
                    ].join(' ')}
                  >
                    {s.relevance}
                  </span>
                </td>
                <td className="px-3 py-2 tabular-nums">{s.score}</td>
                <td className="px-3 py-2 text-muted max-w-[18rem]" title={s.reason ?? ''}>
                  <span className="line-clamp-2">{s.reason ?? '-'}</span>
                </td>
                <td className="px-3 py-2 text-muted text-[11px]">
                  <RelativeTime iso={s.CreatedAt} />
                </td>
                <td className="px-3 py-2">
                  {s.status === 'pending' ? (
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={busyId === s.Id}
                          onClick={() => void handleApprove(s.Id)}
                          className="px-2 py-1 rounded border border-emerald-500/40 text-emerald-400 text-[10px] uppercase tracking-[0.12em] hover:bg-emerald-500/10 disabled:opacity-50"
                        >
                          {busyId === s.Id ? '…' : 'Approve'}
                        </button>
                        <button
                          type="button"
                          disabled={busyId === s.Id}
                          onClick={() => void handleReject(s.Id)}
                          className="px-2 py-1 rounded border border-border text-[10px] uppercase tracking-[0.12em] hover:bg-panel disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                      <input
                        type="text"
                        placeholder="Reject reason (optional)"
                        value={rejectReason[s.Id] ?? ''}
                        onChange={(e) =>
                          setRejectReason((prev) => ({ ...prev, [s.Id]: e.target.value }))
                        }
                        className="px-2 py-1 rounded border border-border bg-panel text-fg text-[11px] w-44"
                      />
                    </div>
                  ) : (
                    <span className="text-muted text-[11px]">{s.status}</span>
                  )}
                </td>
              </tr>
            ))}
            {!isLoading && visibleRows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-muted text-xs">
                  {tab === 'pending'
                    ? 'No pending suggestions. The discover agent runs every ~20 min.'
                    : `No ${tab === 'all' ? '' : tab + ' '}suggestions.`}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function countByStatus(rows: Suggestion[]): Partial<Record<SuggestionStatus, number>> {
  const out: Partial<Record<SuggestionStatus, number>> = {};
  for (const r of rows) {
    out[r.status] = (out[r.status] ?? 0) + 1;
  }
  return out;
}
