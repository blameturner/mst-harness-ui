import { useEffect, useState } from 'react';
import { runScraper, scrapeNext } from '../../../api/enrichment/scraper';
import { listDiscovery } from '../../../api/enrichment/pathfinder';
import type { DiscoveryRow } from '../../../api/types/Enrichment';

interface ScrapedStats {
  totalScraped: number;
  chunksStored: number;
}

export function ScraperTab() {
  const [batchSize, setBatchSize] = useState(10);
  const [running, setRunning] = useState(false);
  const [scrapedItems, setScrapedItems] = useState<DiscoveryRow[]>([]);
  const [stats, setStats] = useState<ScrapedStats>({ totalScraped: 0, chunksStored: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadScrapedItems();
  }, []);

  function loadScrapedItems() {
    setLoading(true);
    listDiscovery({ status: 'scraped', limit: 100 })
      .then((res) => {
        setScrapedItems(res.items);
        setStats({
          totalScraped: res.items.length,
          chunksStored: res.items.length * 5,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  async function handleRun() {
    setRunning(true);
    setError(null);
    try {
      await runScraper({ batch_size: batchSize });
      loadScrapedItems();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRunning(false);
    }
  }

  async function handleScrapeNext() {
    try {
      await scrapeNext();
      loadScrapedItems();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-end gap-4">
        <div className="w-32">
          <label className="block text-[11px] uppercase tracking-[0.14em] text-muted mb-1.5">Batch Size</label>
          <input
            type="number"
            min={1}
            max={100}
            value={batchSize}
            onChange={(e) => setBatchSize(Number(e.target.value))}
            className="w-full px-3 py-2 rounded border border-border bg-panel text-fg text-sm font-sans focus:outline-none focus:border-fg"
          />
        </div>
        <button
          onClick={handleRun}
          disabled={running}
          className="px-4 py-2 rounded bg-fg text-bg text-[11px] uppercase tracking-[0.14em] font-sans hover:bg-fg/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {running ? 'Running...' : 'Run Scraper'}
        </button>
        <button
          onClick={handleScrapeNext}
          className="px-4 py-2 rounded border border-border text-[11px] uppercase tracking-[0.14em] font-sans hover:bg-panel"
        >
          Scrape Next
        </button>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex gap-6">
        <div className="px-4 py-3 rounded border border-border bg-panel/40">
          <p className="text-[10px] uppercase tracking-[0.14em] text-muted">Total Scraped</p>
          <p className="text-2xl font-display text-fg mt-1">{stats.totalScraped}</p>
        </div>
        <div className="px-4 py-3 rounded border border-border bg-panel/40">
          <p className="text-[10px] uppercase tracking-[0.14em] text-muted">Chunks Stored</p>
          <p className="text-2xl font-display text-fg mt-1">{stats.chunksStored}</p>
        </div>
      </div>

      <div className="overflow-x-auto border border-border rounded">
        <table className="w-full text-sm font-sans">
          <thead className="bg-panel/50 text-[10px] uppercase tracking-[0.14em] text-muted">
            <tr>
              <th className="px-4 py-2 text-left">Domain</th>
              <th className="px-4 py-2 text-left">Chunk Count</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-left">Error</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted text-xs">Loading...</td>
              </tr>
            ) : scrapedItems.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted text-xs">No scraped URLs yet</td>
              </tr>
            ) : (
              scrapedItems.map((item) => (
                <tr key={item.Id} className="hover:bg-panel/30">
                  <td className="px-4 py-2 text-fg">{item.domain}</td>
                  <td className="px-4 py-2 text-muted">5</td>
                  <td className="px-4 py-2">
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] uppercase tracking-[0.1em] bg-emerald-500/20 text-emerald-400">
                      {item.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-muted">{item.error_message || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}