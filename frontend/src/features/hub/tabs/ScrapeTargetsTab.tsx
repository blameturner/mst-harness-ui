import { useEffect, useRef, useState } from 'react';
import { listScrapeTargets } from '../../../api/enrichment/scrapeTargets';
import { startScraper } from '../../../api/enrichment/scraper';
import type { ScrapeTargetRow, ScrapeTargetStatus } from '../../../api/types/Enrichment';
import type { ChainKickResponse } from '../../../api/enrichment/chainKick';

const POLL_MS = 10_000;

type StatusFilter = 'all' | 'ok' | 'error' | 'rejected';
type SortField = 'url' | 'name' | 'category' | 'status' | 'last_scraped_at' | 'chunk_count' | 'consecutive_failures';
type SortDir = 'asc' | 'desc';

function formatKick(r: ChainKickResponse): string {
  switch (r.status) {
    case 'kicked':
      return `kicked (queued ${r.queued})`;
    case 'already_running':
      return `already_running (inflight ${r.inflight})`;
    case 'disabled':
      return 'disabled';
    case 'no_queue':
      return 'no_queue';
  }
}

function formatRelative(iso?: string): string {
  if (!iso) return '—';
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return iso;
  const diff = Date.now() - then;
  const sec = Math.round(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 48) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  return `${day}d ago`;
}

function statusPill(status: ScrapeTargetStatus | undefined) {
  const label = status ?? 'never';
  let cls: string;
  switch (status) {
    case 'ok':
      cls = 'bg-emerald-500/20 text-emerald-400';
      break;
    case 'error':
      cls = 'bg-red-500/20 text-red-400';
      break;
    case 'rejected':
      cls = 'bg-amber-500/20 text-amber-400';
      break;
    default:
      cls = 'bg-panel text-muted';
  }
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-[10px] uppercase tracking-[0.1em] ${cls}`}
    >
      {label}
    </span>
  );
}

export function ScrapeTargetsTab() {
  const [rows, setRows] = useState<ScrapeTargetRow[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [activeOnly, setActiveOnly] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<'all' | ScrapeTargetRow['category']>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('last_scraped_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);

  const [kickBusy, setKickBusy] = useState(false);
  const [kickStatus, setKickStatus] = useState<string | null>(null);

  const pollRef = useRef<number | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    listScrapeTargets({
      status: statusFilter === 'all' ? undefined : statusFilter,
      active_only: activeOnly,
      category: categoryFilter === 'all' ? undefined : categoryFilter,
      q: searchQuery.trim() || undefined,
      sort_by: sortField,
      sort_dir: sortDir,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    })
      .then((res) => {
        setRows(res?.rows ?? []);
        setTotalRows(typeof res?.total === 'number' ? res.total : 0);
      })
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    if (pollRef.current != null) window.clearInterval(pollRef.current);
    pollRef.current = window.setInterval(load, POLL_MS);
    return () => {
      if (pollRef.current != null) window.clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, activeOnly, categoryFilter, searchQuery, sortField, sortDir, pageSize, page]);

  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  async function handleKick() {
    setKickBusy(true);
    setKickStatus(null);
    try {
      const res = await startScraper();
      setKickStatus(formatKick(res));
      load();
    } catch (err) {
      setKickStatus(`error: ${(err as Error).message}`);
    } finally {
      setKickBusy(false);
      window.setTimeout(() => setKickStatus(null), 5000);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={handleKick}
          disabled={kickBusy}
          className="px-3 py-1.5 rounded border border-border text-[11px] uppercase tracking-[0.14em] font-sans hover:bg-panel disabled:opacity-50"
        >
          {kickBusy ? 'Kicking…' : 'Kick scraper chain'}
        </button>
        {kickStatus && (
          <span className="text-[11px] uppercase tracking-[0.14em] text-muted">{kickStatus}</span>
        )}
      </div>

      <div className="flex items-end gap-4 flex-wrap">
        <div className="w-40">
          <label className="block text-[11px] uppercase tracking-[0.14em] text-muted mb-1.5">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as StatusFilter);
              setPage(1);
            }}
            className="w-full px-3 py-2 rounded border border-border bg-panel text-fg text-sm font-sans focus:outline-none focus:border-fg"
          >
            <option value="all">all</option>
            <option value="ok">ok</option>
            <option value="error">error</option>
            <option value="rejected">rejected</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-muted pb-2">
          <input
            type="checkbox"
            checked={activeOnly}
            onChange={(e) => {
              setActiveOnly(e.target.checked);
              setPage(1);
            }}
          />
          active only
        </label>
        <div className="w-40">
          <label className="block text-[11px] uppercase tracking-[0.14em] text-muted mb-1.5">Category</label>
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value as 'all' | ScrapeTargetRow['category']);
              setPage(1);
            }}
            className="w-full px-3 py-2 rounded border border-border bg-panel text-fg text-sm font-sans focus:outline-none focus:border-fg"
          >
            <option value="all">all</option>
            <option value="documentation">documentation</option>
            <option value="news">news</option>
            <option value="competitive">competitive</option>
            <option value="regulatory">regulatory</option>
            <option value="research">research</option>
            <option value="security">security</option>
            <option value="model_releases">model_releases</option>
            <option value="auto">auto</option>
          </select>
        </div>
        <div className="w-56">
          <label className="block text-[11px] uppercase tracking-[0.14em] text-muted mb-1.5">Search</label>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder="URL or name"
            className="w-full px-3 py-2 rounded border border-border bg-panel text-fg text-sm font-sans focus:outline-none focus:border-fg"
          />
        </div>
        <div className="w-40">
          <label className="block text-[11px] uppercase tracking-[0.14em] text-muted mb-1.5">Sort</label>
          <select
            value={sortField}
            onChange={(e) => {
              setSortField(e.target.value as SortField);
              setPage(1);
            }}
            className="w-full px-3 py-2 rounded border border-border bg-panel text-fg text-sm font-sans focus:outline-none focus:border-fg"
          >
            <option value="last_scraped_at">last scraped</option>
            <option value="url">url</option>
            <option value="name">name</option>
            <option value="category">category</option>
            <option value="status">status</option>
            <option value="chunk_count">chunks</option>
            <option value="consecutive_failures">fails</option>
          </select>
        </div>
        <div className="w-32">
          <label className="block text-[11px] uppercase tracking-[0.14em] text-muted mb-1.5">Direction</label>
          <select
            value={sortDir}
            onChange={(e) => {
              setSortDir(e.target.value as SortDir);
              setPage(1);
            }}
            className="w-full px-3 py-2 rounded border border-border bg-panel text-fg text-sm font-sans focus:outline-none focus:border-fg"
          >
            <option value="desc">desc</option>
            <option value="asc">asc</option>
          </select>
        </div>
        <div className="w-28">
          <label className="block text-[11px] uppercase tracking-[0.14em] text-muted mb-1.5">Per page</label>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="w-full px-3 py-2 rounded border border-border bg-panel text-fg text-sm font-sans focus:outline-none focus:border-fg"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="px-3 py-2 rounded border border-border text-[11px] uppercase tracking-[0.14em] font-sans hover:bg-panel disabled:opacity-50"
          title="Refresh"
        >
          ↻
        </button>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.14em] font-sans text-muted">
        <span>
          Showing {(page - 1) * pageSize + (rows.length ? 1 : 0)}-{(page - 1) * pageSize + rows.length} of {totalRows}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || loading}
            className="px-2 py-1 rounded border border-border hover:bg-panel disabled:opacity-50"
          >
            Prev
          </button>
          <span>
            Page {page} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || loading}
            className="px-2 py-1 rounded border border-border hover:bg-panel disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>

      <div className="overflow-x-auto border border-border rounded">
        <table className="w-full text-sm font-sans">
          <thead className="bg-panel/50 text-[10px] uppercase tracking-[0.14em] text-muted">
            <tr>
              <th className="px-4 py-2 text-left">URL</th>
              <th className="px-4 py-2 text-left">Name</th>
              <th className="px-4 py-2 text-left">Category</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-left">Active</th>
              <th className="px-4 py-2 text-left">Fails</th>
              <th className="px-4 py-2 text-left">Last Scraped</th>
              <th className="px-4 py-2 text-left">Chunks</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted text-xs">Loading...</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted text-xs">No scrape targets</td>
              </tr>
            ) : (
              rows.map((t) => (
                <tr key={t.Id} className="hover:bg-panel/30">
                  <td className="px-4 py-2 text-fg truncate max-w-xs">
                    <a
                      href={t.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="hover:underline"
                    >
                      {t.url}
                    </a>
                  </td>
                  <td className="px-4 py-2 text-muted truncate max-w-[14rem]">{t.name}</td>
                  <td className="px-4 py-2 text-muted">{t.category}</td>
                  <td className="px-4 py-2">{statusPill(t.status ?? undefined)}</td>
                  <td className="px-4 py-2 text-muted">{t.active === 1 ? 'active' : 'paused'}</td>
                  <td className="px-4 py-2 text-muted">{t.consecutive_failures ?? 0}</td>
                  <td className="px-4 py-2 text-muted">{formatRelative(t.last_scraped_at)}</td>
                  <td className="px-4 py-2 text-muted">{t.chunk_count ?? 0}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
