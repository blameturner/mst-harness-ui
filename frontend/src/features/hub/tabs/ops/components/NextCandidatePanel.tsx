// frontend/src/features/hub/tabs/ops/components/NextCandidatePanel.tsx
import type {
  PathfinderPreviewResponse,
  ScraperPreviewResponse,
} from '../../../../../api/types/PipelineSummary';
import { fmt, valueAt } from '../lib/formatters';
import { bucketStyle } from '../lib/selectionBucket';
import { HelpTooltip } from './HelpTooltip';
import { RelativeTime } from './RelativeTime';
import { StatusChip } from './StatusChip';

export interface NextCandidatePanelProps {
  pathfinder: PathfinderPreviewResponse | null;
  scraper: ScraperPreviewResponse | null;
  loadingPath: boolean;
  loadingScrape: boolean;
  errorPath: string | null;
  errorScrape: string | null;
  lastEvaluatedAt: number | null;
  onReevaluate: () => void;
}

export function NextCandidatePanel(props: NextCandidatePanelProps) {
  const {
    pathfinder,
    scraper,
    loadingPath,
    loadingScrape,
    errorPath,
    errorScrape,
    lastEvaluatedAt,
    onReevaluate,
  } = props;

  return (
    <aside className="border border-border rounded p-3 space-y-4 sticky top-2">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-base">Next candidate</h3>
        <button
          type="button"
          onClick={onReevaluate}
          className="px-2 py-1 rounded border border-border text-[10px] uppercase tracking-[0.12em] hover:bg-panel"
        >
          Re-evaluate
        </button>
      </div>
      {lastEvaluatedAt && (
        <p className="text-[10px] text-muted">
          evaluated <RelativeTime iso={new Date(lastEvaluatedAt).toISOString()} />
        </p>
      )}

      <section className="space-y-2">
        <div className="flex items-center gap-1.5">
          <p className="text-[10px] uppercase tracking-[0.16em] text-muted">Pathfinder seed</p>
          <HelpTooltip>
            Pathfinder seed can come from discovery roots or scrape-target fallback. Fallback is
            intentionally limited to manual targets and shallow/root-like auto targets so deep old
            docs are not re-used as seeds endlessly.
          </HelpTooltip>
        </div>
        {loadingPath && <p className="text-xs text-muted">Loading…</p>}
        {errorPath && <p className="text-xs text-red-500">{errorPath}</p>}
        {!loadingPath && !errorPath && renderPathfinder(pathfinder)}
      </section>

      <section className="space-y-2">
        <div className="flex items-center gap-1.5">
          <p className="text-[10px] uppercase tracking-[0.16em] text-muted">Scraper target</p>
          <HelpTooltip>
            Current scraper target order: manual never-scraped → manual due → auto due → auto
            never-scraped. Brand-new auto URLs do not always win; due auto rows are processed
            before fresh ones.
          </HelpTooltip>
        </div>
        {loadingScrape && <p className="text-xs text-muted">Loading…</p>}
        {errorScrape && <p className="text-xs text-red-500">{errorScrape}</p>}
        {!loadingScrape && !errorScrape && renderScraper(scraper)}
      </section>
    </aside>
  );
}

function renderPathfinder(p: PathfinderPreviewResponse | null) {
  if (!p || !p.row) {
    return <p className="text-xs text-muted">No candidate selected right now.</p>;
  }
  const row = p.row;
  return (
    <div className="space-y-1 text-sm">
      <p className="break-all">{fmt(valueAt(row, 'url') ?? valueAt(row, 'seed_url'))}</p>
      <div className="flex items-center gap-2 flex-wrap text-[11px]">
        <span className="px-1.5 py-0.5 rounded border border-border text-muted uppercase tracking-[0.12em]">
          source: {fmt(p.source)}
        </span>
        <StatusChip status={fmt(valueAt(row, 'status'))} />
      </div>
    </div>
  );
}

function renderScraper(s: ScraperPreviewResponse | null) {
  if (!s || !s.row) {
    return <p className="text-xs text-muted">No candidate selected right now.</p>;
  }
  const row = s.row;
  const bucket = bucketStyle(row._selection_bucket);
  return (
    <div className="space-y-1 text-sm">
      <p className="break-all">{fmt(valueAt(row, 'url'))}</p>
      <div className="flex items-center gap-2 flex-wrap text-[11px]">
        {bucket && (
          <span className={`px-1.5 py-0.5 rounded uppercase tracking-[0.12em] ${bucket.className}`}>
            {bucket.label}
          </span>
        )}
        <StatusChip status={fmt(valueAt(row, 'status'))} />
        {valueAt(row, 'next_crawl_at') != null && (
          <span className="text-muted">
            next: <RelativeTime iso={String(valueAt(row, 'next_crawl_at'))} />
          </span>
        )}
      </div>
    </div>
  );
}
