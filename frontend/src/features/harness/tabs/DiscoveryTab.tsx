import { useEffect, useState } from 'react';
import { discover, listDiscovery, fetchNextUrl, markUrlProcessed } from '../../../api/enrichment/pathfinder';
import type { DiscoveryRow } from '../../../api/types/Enrichment';

export function DiscoveryTab() {
  const [seedUrl, setSeedUrl] = useState('');
  const [maxDepth, setMaxDepth] = useState(3);
  const [items, setItems] = useState<DiscoveryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadItems();
  }, []);

  function loadItems() {
    setLoading(true);
    listDiscovery({ limit: 100 })
      .then((res) => setItems(res.items))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  async function handleStart() {
    if (!seedUrl) return;
    setStarting(true);
    setError(null);
    try {
      await discover({ seed_url: seedUrl, max_depth: maxDepth });
      loadItems();
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
  }

  const statusCounts = items.reduce(
    (acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="p-6 space-y-6">
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

      <div className="flex gap-4 text-[11px] text-muted">
        {Object.entries(statusCounts).map(([status, count]) => (
          <span key={status}>
            {status}: {count}
          </span>
        ))}
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
                <tr key={item.Id} className="hover:bg-panel/30">
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
    </div>
  );
}