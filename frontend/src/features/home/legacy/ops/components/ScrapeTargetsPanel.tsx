// frontend/src/features/hub/tabs/ops/components/ScrapeTargetsPanel.tsx
import { useMemo, useState } from 'react';
import { getScrapeTargetRow } from '../../../../../api/enrichment/getScrapeTargetRow';
import { runScrapeTargetNow } from '../../../../../api/enrichment/runScrapeTargetNow';
import type { OpsDashboardResponse } from '../../../../../api/types/OpsDashboard';
import type { ScraperPreviewResponse } from '../../../../../api/types/PipelineSummary';
import { extractApiFailure, fmt, rowIdFromAny, valueAt } from '../lib/formatters';
import { bucketStyle } from '../lib/selectionBucket';
import { RowDrawer } from './RowDrawer';
import { RelativeTime } from './RelativeTime';
import { StatusChip } from './StatusChip';

type Filter = 'all' | 'ok' | 'error' | 'scraping' | 'rejected';

export interface ScrapeTargetsPanelProps {
  scrapeTargets?: OpsDashboardResponse['scrape_targets'];
  scraperPreview?: ScraperPreviewResponse | null;
  triggersDisabled?: boolean;
  onActionComplete: () => void;
  loading?: boolean;
}

export function ScrapeTargetsPanel({
  scrapeTargets,
  scraperPreview,
  triggersDisabled,
  onActionComplete,
  loading,
}: ScrapeTargetsPanelProps) {
  const rows = (scrapeTargets?.rows ?? []) as Array<Record<string, unknown>>;
  const [filter, setFilter] = useState<Filter>('all');
  const [activeOnly, setActiveOnly] = useState(true);
  const filtered = useMemo(() => {
    const stageOne = activeOnly ? rows.filter((r) => valueAt(r, 'active') === 1) : rows;
    const stageTwo = filterRows(stageOne, filter);
    return [...stageTwo].sort(compareByNextCrawlAt);
  }, [rows, filter, activeOnly]);

  // Map id → bucket from the latest preview, if any.
  const previewBucket = useMemo(() => {
    const previewRow = scraperPreview?.row;
    if (!previewRow) return null;
    const id = rowIdFromAny(previewRow);
    if (id == null) return null;
    return { id, bucket: previewRow._selection_bucket };
  }, [scraperPreview]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerId, setDrawerId] = useState<string>('');
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerError, setDrawerError] = useState<string | null>(null);
  const [drawerData, setDrawerData] = useState<unknown>(null);

  const [runBusyId, setRunBusyId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  async function openDrawer(id: string) {
    setDrawerId(id);
    setDrawerOpen(true);
    setDrawerLoading(true);
    setDrawerError(null);
    setDrawerData(null);
    try {
      const row = await getScrapeTargetRow(id);
      setDrawerData(row);
    } catch (err) {
      setDrawerError(extractApiFailure(err).message);
    } finally {
      setDrawerLoading(false);
    }
  }

  async function handleRunNow(id: string) {
    setRunBusyId(id);
    setActionMessage(null);
    try {
      const res = await runScrapeTargetNow(id);
      if (res.status === 'queued') {
        setActionMessage(`queued job ${res.job_id ?? ''} for target ${res.target_id ?? id}`);
      } else if (res.status === 'failed') {
        setActionMessage(`failed: ${res.error ?? 'unknown'}`);
      } else {
        setActionMessage(`status: ${res.status}`);
      }
      onActionComplete();
    } catch (err) {
      setActionMessage(`error: ${extractApiFailure(err).message}`);
    } finally {
      setRunBusyId(null);
      window.setTimeout(() => setActionMessage(null), 6000);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <FilterChips
            value={filter}
            onChange={setFilter}
            options={[
              { id: 'all', label: 'All' },
              { id: 'ok', label: 'Ok' },
              { id: 'scraping', label: 'Scraping' },
              { id: 'error', label: 'Error' },
              { id: 'rejected', label: 'Rejected' },
            ]}
          />
          <label className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] text-muted">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
            />
            Active only
          </label>
        </div>
        {actionMessage && (
          <span className="text-[11px] uppercase tracking-[0.14em] text-muted">{actionMessage}</span>
        )}
      </div>

      <div className="overflow-x-auto border border-border rounded">
        <table className="w-full text-sm font-sans">
          <thead className="bg-panel/50 text-[10px] uppercase tracking-[0.14em] text-muted">
            <tr>
              <th className="px-3 py-2 text-left">Id</th>
              <th className="px-3 py-2 text-left">URL</th>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Active</th>
              <th className="px-3 py-2 text-left">Auto</th>
              <th className="px-3 py-2 text-left">Depth</th>
              <th className="px-3 py-2 text-left">Freq (h)</th>
              <th className="px-3 py-2 text-left">Last scraped</th>
              <th className="px-3 py-2 text-left">Next crawl</th>
              <th className="px-3 py-2 text-left">Fails</th>
              <th className="px-3 py-2 text-left">Unchanged</th>
              <th className="px-3 py-2 text-left">Chunks</th>
              <th className="px-3 py-2 text-left">Bucket</th>
              <th className="px-3 py-2 text-left">Last error</th>
              <th className="px-3 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((r, idx) => {
              const id = rowIdFromAny(r);
              const bucketForRow =
                previewBucket && id === previewBucket.id ? bucketStyle(previewBucket.bucket) : null;
              return (
                <tr key={id ?? `target-${idx}`} className="hover:bg-panel/30">
                  <td className="px-3 py-2">{fmt(id)}</td>
                  <td className="px-3 py-2 max-w-[20rem] truncate">{fmt(valueAt(r, 'url'))}</td>
                  <td className="px-3 py-2 max-w-[10rem] truncate">{fmt(valueAt(r, 'name'))}</td>
                  <td className="px-3 py-2"><StatusChip status={String(valueAt(r, 'status') ?? '')} /></td>
                  <td className="px-3 py-2">{valueAt(r, 'active') === 1 ? 'yes' : 'no'}</td>
                  <td className="px-3 py-2">{valueAt(r, 'auto_crawled') === 1 ? 'yes' : 'no'}</td>
                  <td className="px-3 py-2">{fmt(valueAt(r, 'depth'))}</td>
                  <td className="px-3 py-2">{fmt(valueAt(r, 'frequency_hours'))}</td>
                  <td className="px-3 py-2"><RelativeTime iso={valueAt(r, 'last_scraped_at') as string | null | undefined} /></td>
                  <td className="px-3 py-2"><RelativeTime iso={valueAt(r, 'next_crawl_at') as string | null | undefined} /></td>
                  <td className="px-3 py-2">
                    {(() => {
                      const n = Number(valueAt(r, 'consecutive_failures') ?? 0);
                      return <span className={n >= 3 ? 'text-red-400 font-medium' : ''}>{n}</span>;
                    })()}
                  </td>
                  <td className="px-3 py-2">{fmt(valueAt(r, 'consecutive_unchanged'))}</td>
                  <td className="px-3 py-2">{fmt(valueAt(r, 'chunk_count'))}</td>
                  <td className="px-3 py-2">
                    {bucketForRow ? (
                      <span className={`px-1.5 py-0.5 rounded uppercase tracking-[0.12em] text-[10px] ${bucketForRow.className}`}>
                        {bucketForRow.label}
                      </span>
                    ) : (
                      <span className="text-muted text-xs">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2 max-w-[16rem] truncate">{fmt(valueAt(r, 'last_scrape_error'))}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      {id && (
                        <button
                          type="button"
                          disabled={triggersDisabled || runBusyId === id}
                          onClick={() => void handleRunNow(id)}
                          className="px-2 py-1 rounded border border-border text-[10px] uppercase tracking-[0.12em] hover:bg-panel disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {runBusyId === id ? '…' : 'Run now'}
                        </button>
                      )}
                      {id && (
                        <button
                          type="button"
                          onClick={() => void openDrawer(id)}
                          className="px-2 py-1 rounded border border-border text-[10px] uppercase tracking-[0.12em] hover:bg-panel"
                        >
                          Open
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={16} className="px-3 py-6 text-center text-muted text-xs">
                  No scrape targets
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <RowDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        kind="target"
        id={drawerId}
        loading={drawerLoading}
        error={drawerError}
        data={drawerData}
        extra={renderTargetExtra(drawerData)}
      />
    </div>
  );
}

function filterRows(rows: Array<Record<string, unknown>>, filter: Filter) {
  if (filter === 'all') return rows;
  return rows.filter((r) => String(valueAt(r, 'status') ?? '') === filter);
}

function compareByNextCrawlAt(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): number {
  const av = valueAt(a, 'next_crawl_at');
  const bv = valueAt(b, 'next_crawl_at');
  const ae = av == null || av === '';
  const be = bv == null || bv === '';
  if (ae && be) {
    const ca = Date.parse(String(valueAt(a, 'CreatedAt') ?? ''));
    const cb = Date.parse(String(valueAt(b, 'CreatedAt') ?? ''));
    return (Number.isNaN(ca) ? 0 : ca) - (Number.isNaN(cb) ? 0 : cb);
  }
  if (ae) return -1;
  if (be) return 1;
  const aT = Date.parse(String(av));
  const bT = Date.parse(String(bv));
  return (Number.isNaN(aT) ? 0 : aT) - (Number.isNaN(bT) ? 0 : bT);
}

function renderTargetExtra(data: unknown): React.ReactNode {
  if (!data || typeof data !== 'object') return null;
  const row = data as Record<string, unknown>;
  const summary = row.summary;
  if (typeof summary !== 'string' || summary.trim() === '') return null;
  return (
    <details open>
      <summary className="text-[11px] uppercase tracking-[0.14em] text-muted cursor-pointer">
        Summary
      </summary>
      <p className="mt-2 p-3 rounded border border-border bg-panel/60 text-sm whitespace-pre-wrap">
        {summary}
      </p>
    </details>
  );
}

interface FilterOpt<T extends string> {
  id: T;
  label: string;
}

function FilterChips<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (next: T) => void;
  options: ReadonlyArray<FilterOpt<T>>;
}) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={[
            'px-2 py-1 rounded border text-[10px] uppercase tracking-[0.14em]',
            value === o.id ? 'border-fg text-fg' : 'border-border text-muted hover:text-fg',
          ].join(' ')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
