import { useEffect, useRef, useState } from 'react';
import {
  discover,
  listDiscovery,
  fetchNextUrl,
  startPathfinder,
} from '../../../api/enrichment/pathfinder';
import { listScrapeTargets } from '../../../api/enrichment/scrapeTargets';
import type { DiscoveryRow, ScrapeTargetRow } from '../../../api/types/Enrichment';
import type { ChainKickResponse } from '../../../api/enrichment/chainKick';

const POLL_INTERVAL_MS = 2500;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

type TerminalStatus = 'processed' | 'failed';
const TERMINAL: TerminalStatus[] = ['processed', 'failed'];

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

export function DiscoveryTab() {
  const [seedUrl, setSeedUrl] = useState('');
  const [maxDepth, setMaxDepth] = useState(3);
  const [items, setItems] = useState<DiscoveryRow[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [targets, setTargets] = useState<ScrapeTargetRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeDiscoveryId, setActiveDiscoveryId] = useState<number | null>(null);
  const [queuedBanner, setQueuedBanner] = useState<string | null>(null);
  const [pollExpired, setPollExpired] = useState(false);

  const [kickBusy, setKickBusy] = useState(false);
  const [kickStatus, setKickStatus] = useState<string | null>(null);

  const pollRef = useRef<number | null>(null);
  const pollStartRef = useRef<number | null>(null);

  useEffect(() => {
    loadItems();
  }, [page, pageSize]);

  useEffect(() => {
    loadTargets();
    return () => {
      stopPolling();
    };
  }, []);

  function stopPolling() {
    if (pollRef.current != null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
    pollStartRef.current = null;
  }

  function loadItems() {
    setLoading(true);
    listDiscovery({
      limit: pageSize,
      offset: (page - 1) * pageSize,
      sort_by: 'Id',
      sort_dir: 'desc',
    })
      .then((res) => {
        setItems(res?.items ?? []);
        setTotalItems(typeof res?.total === 'number' ? res.total : 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  function loadTargets() {
    // Pathfinder now writes found URLs to scrape_targets, not discovery, so we poll both.
    listScrapeTargets({ active_only: true, limit: 50 })
      .then((res) => setTargets(res?.rows ?? []))
      .catch(() => {});
  }

  function pollOnce() {
    loadItems();
    loadTargets();
  }

  function startPolling(discoveryId: number) {
    stopPolling();
    setPollExpired(false);
    setActiveDiscoveryId(discoveryId);
    pollStartRef.current = Date.now();
    pollRef.current = window.setInterval(() => {
      if (pollStartRef.current && Date.now() - pollStartRef.current > POLL_TIMEOUT_MS) {
        setPollExpired(true);
        stopPolling();
        return;
      }
      pollOnce();
    }, POLL_INTERVAL_MS);
  }

  useEffect(() => {
    if (activeDiscoveryId == null) return;
    const row = items.find((r) => r.Id === activeDiscoveryId);
    if (row && TERMINAL.includes(row.status as TerminalStatus)) {
      stopPolling();
    }
  }, [items, activeDiscoveryId]);

  async function handleStart() {
    if (!seedUrl) return;
    setStarting(true);
    setError(null);
    setPollExpired(false);
    try {
      const res = await discover({ seed_url: seedUrl, max_depth: maxDepth });
      setQueuedBanner(`queued discovery #${res.discovery_id} (job ${res.job_id})`);
      setPage(1);
      loadItems();
      loadTargets();
      startPolling(res.discovery_id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setStarting(false);
    }
  }

  async function handlePause() {
    await fetchNextUrl().catch(() => {});
  }

  async function handleClear() {
    setItems([]);
    setTotalItems(0);
    setPage(1);
    setTargets([]);
    setQueuedBanner(null);
    setActiveDiscoveryId(null);
    stopPolling();
  }

  async function handleKick() {
    setKickBusy(true);
    setKickStatus(null);
    try {
      const res = await startPathfinder();
      setKickStatus(formatKick(res));
    } catch (err) {
      setKickStatus(`error: ${(err as Error).message}`);
    } finally {
      setKickBusy(false);
      window.setTimeout(() => setKickStatus(null), 5000);
    }
  }

  const statusCounts = items.reduce(
    (acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const activeRow =
    activeDiscoveryId != null ? items.find((r) => r.Id === activeDiscoveryId) : undefined;
  const activeTerminal = !!activeRow && TERMINAL.includes(activeRow.status as TerminalStatus);
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={handleKick}
          disabled={kickBusy}
          className="px-3 py-1.5 rounded border border-border text-[11px] uppercase tracking-[0.14em] font-sans hover:bg-panel disabled:opacity-50"
        >
          {kickBusy ? 'Kicking…' : 'Kick pathfinder chain'}
        </button>
        {kickStatus && (
          <span className="text-[11px] uppercase tracking-[0.14em] text-muted">{kickStatus}</span>
        )}
      </div>

      <div className="flex items-end gap-4">
        <div className="flex-1">
          <label className="block text-[11px] uppercase tracking-[0.14em] text-muted mb-1.5">Seed URL</label>
          <input
            type="url"
            value={seedUrl}
            onChange={(e) => setSeedUrl(e.target.value)}
            placeholder="https://example.com"
            className="w-full px-3 py-2 rounded border border-border bg-panel text-fg text-sm font-sans focus:outline-none focus:border-fg"
          />
        </div>
        <div className="w-24">
          <label className="block text-[11px] uppercase tracking-[0.14em] text-muted mb-1.5">Max Depth</label>
          <input
            type="number"
            min={1}
            max={10}
            value={maxDepth}
            onChange={(e) => setMaxDepth(Number(e.target.value))}
            className="w-full px-3 py-2 rounded border border-border bg-panel text-fg text-sm font-sans focus:outline-none focus:border-fg"
          />
        </div>
        <button
          onClick={handleStart}
          disabled={!seedUrl || starting}
          className="px-4 py-2 rounded bg-fg text-bg text-[11px] uppercase tracking-[0.14em] font-sans hover:bg-fg/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {starting ? 'Starting...' : 'Start'}
        </button>
        <button
          onClick={handlePause}
          className="px-4 py-2 rounded border border-border text-[11px] uppercase tracking-[0.14em] font-sans hover:bg-panel"
        >
          Pause
        </button>
        <button
          onClick={handleClear}
          className="px-4 py-2 rounded border border-border text-[11px] uppercase tracking-[0.14em] font-sans hover:bg-panel"
        >
          Clear
        </button>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      {queuedBanner && (
        <div className="px-3 py-2 rounded border border-border bg-panel/40 text-[11px] uppercase tracking-[0.14em] text-muted flex items-center gap-3">
          <span>{queuedBanner}</span>
          {activeRow ? (
            <span className="text-fg">status: {activeRow.status}</span>
          ) : (
            <span>status: queued</span>
          )}
          {activeTerminal && <span className="text-emerald-400">done</span>}
          {pollExpired && !activeTerminal && (
            <span className="text-amber-500">still running, refresh to check</span>
          )}
        </div>
      )}

      <div className="flex gap-4 text-[11px] text-muted">
        {Object.entries(statusCounts).map(([status, count]) => (
          <span key={status}>
            {status}: {count}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.14em] font-sans text-muted">
        <span>
          Showing {(page - 1) * pageSize + (items.length ? 1 : 0)}-
          {(page - 1) * pageSize + items.length} of {totalItems}
        </span>
        <div className="flex items-center gap-2">
          <label htmlFor="discovery-page-size" className="text-muted">Per page</label>
          <select
            id="discovery-page-size"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="px-2 py-1 rounded border border-border bg-panel text-fg text-[11px]"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
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
              <th className="px-4 py-2 text-left">Domain</th>
              <th className="px-4 py-2 text-left">Depth</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-left">Source</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted text-xs">Loading...</td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted text-xs">No URLs discovered yet</td>
              </tr>
            ) : (
              items.map((item) => (
                <tr
                  key={item.Id}
                  className={`hover:bg-panel/30 ${item.Id === activeDiscoveryId ? 'bg-panel/40' : ''}`}
                >
                  <td className="px-4 py-2 text-fg truncate max-w-xs">{item.url}</td>
                  <td className="px-4 py-2 text-muted">{item.domain}</td>
                  <td className="px-4 py-2 text-muted">{item.depth}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] uppercase tracking-[0.1em] ${
                        item.status === 'processed'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : item.status === 'failed'
                          ? 'bg-red-500/20 text-red-400'
                          : item.status === 'scraping'
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'bg-panel text-muted'
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-muted truncate max-w-xs">{item.source_url}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {targets.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-[0.16em] text-muted">
            Scrape targets (live) — {targets.length}
          </p>
          <div className="overflow-x-auto border border-border rounded">
            <table className="w-full text-sm font-sans">
              <thead className="bg-panel/50 text-[10px] uppercase tracking-[0.14em] text-muted">
                <tr>
                  <th className="px-4 py-2 text-left">URL</th>
                  <th className="px-4 py-2 text-left">Name</th>
                  <th className="px-4 py-2 text-left">Category</th>
                  <th className="px-4 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {targets.slice(0, 20).map((t) => (
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
                    <td className="px-4 py-2 text-muted">{t.name}</td>
                    <td className="px-4 py-2 text-muted">{t.category}</td>
                    <td className="px-4 py-2 text-muted">{t.status ?? 'never'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
