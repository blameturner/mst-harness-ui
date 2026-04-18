# Enrichment Operations UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the body of the Hub → Ops tab with a ribbon + 3-sub-tab + side-panel layout that surfaces what will run next, why something is not running, and lets operators run targets / retry jobs without admin tools.

**Architecture:** A single new orchestrator (`ops/OpsTab.tsx`) hangs off the existing `HubPage`. It owns org state and a sub-tab selector. Data is driven by one polling/SSE-aware hook (`useOpsDashboard`) that calls `/api/ops/dashboard`; a second hook (`useNextCandidatePreview`) handles on-demand pathfinder/scraper preview probes. Everything else is presentational components composed into a ribbon, three sub-panels (Discovery / Scrape Targets / Queue Jobs), and a sticky side panel.

**Tech Stack:** React 18 + TypeScript (strict), TanStack Router, Tailwind CSS, ky HTTP client, Hono on the gateway, EventSource for SSE. No frontend test framework exists in this repo; verification gates are `tsc --noEmit`, `vite build`, and a manual browser smoke pass against a running harness.

**Conventions:**
- Files: kebab `import` paths, PascalCase component file names, camelCase hooks (`useFoo.ts`), camelCase API client files (`runScrapeTargetNow.ts`).
- Component style: Tailwind utility classes; the existing `text-[11px] uppercase tracking-[0.14em]` micro-label style; status chips via the prescribed palette.
- After every task, the worktree must type-check (`npx tsc -p frontend --noEmit && npx tsc -p gateway --noEmit`) and commit.
- Co-author trailer: `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.

---

## File Structure

**New files:**

```
docs/superpowers/plans/2026-04-18-enrichment-ops-ui.md   (this file)

frontend/src/api/enrichment/
  runScrapeTargetNow.ts                — POST /api/enrichment/scrape-targets/:id/run-now
  fetchNextPathfinderSeed.ts           — POST /api/enrichment/pathfinder/fetch-next   (preview)
  fetchNextScraperTarget.ts            — POST /api/enrichment/scraper/scrape-next     (preview)
frontend/src/api/queue/
  retryQueueJob.ts                     — POST /api/queue/jobs/:id/retry
frontend/src/api/types/
  PipelineSummary.ts                   — pipeline.{config,schedule,last_jobs,next_candidates} types

frontend/src/features/hub/tabs/ops/
  OpsTab.tsx                           — orchestrator
  hooks/
    useOpsDashboard.ts
    useNextCandidatePreview.ts
  components/
    PipelineRibbon.tsx
    PipelineCard.tsx
    NextCandidatePanel.tsx
    DiscoveryPanel.tsx
    ScrapeTargetsPanel.tsx
    QueueJobsPanel.tsx
    StatusChip.tsx
    RelativeTime.tsx
    HelpTooltip.tsx
    RowDrawer.tsx
  lib/
    formatters.ts
    selectionBucket.ts
```

**Modified files:**

```
gateway/src/routes/enrichment.ts       — add POST /scrape-targets/:id/run-now passthrough
gateway/src/routes/queue.ts            — add POST /jobs/:id/retry passthrough
frontend/src/api/types/OpsDashboard.ts — extend with pipeline, error, message fields
frontend/src/features/hub/HubPage.tsx  — update OpsTab import path
```

**Deleted files:**

```
frontend/src/features/hub/tabs/OpsTab.tsx   — replaced by ops/OpsTab.tsx
```

---

## Task 1: Extend OpsDashboard types and add PipelineSummary types

**Files:**
- Create: `frontend/src/api/types/PipelineSummary.ts`
- Modify: `frontend/src/api/types/OpsDashboard.ts`

- [ ] **Step 1: Create `PipelineSummary.ts` with the new pipeline-related types**

```ts
// frontend/src/api/types/PipelineSummary.ts

export type PipelineKind = 'scraper' | 'pathfinder' | 'discover_agent';

export interface PipelineKindConfig {
  enabled?: boolean;
  interval_minutes?: number | null;
  cooldown_seconds?: number | null;
  [k: string]: unknown;
}

export interface PipelineConfig {
  scraper?: PipelineKindConfig;
  pathfinder?: PipelineKindConfig;
  discover_agent?: PipelineKindConfig;
  [k: string]: unknown;
}

export interface PipelineKindSchedule {
  next_run?: string | null;
  last_run?: string | null;
  cooldown_until?: string | null;
  [k: string]: unknown;
}

export interface PipelineSchedule {
  scraper?: PipelineKindSchedule;
  pathfinder?: PipelineKindSchedule;
  discover_agent?: PipelineKindSchedule;
  [k: string]: unknown;
}

export interface PipelineLastJob {
  job_id?: string | null;
  status?: string | null;
  result_status?: string | null;
  error?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  [k: string]: unknown;
}

export interface PipelineLastJobs {
  scraper?: PipelineLastJob | null;
  pathfinder?: PipelineLastJob | null;
  discover_agent?: PipelineLastJob | null;
  [k: string]: unknown;
}

/** Pathfinder preview: result of POST /enrichment/pathfinder/fetch-next. */
export interface PathfinderPreviewResponse {
  status: string;
  source?: 'discovery' | 'scrape_target_fallback' | string | null;
  row?: Record<string, unknown> | null;
  error?: string | null;
}

/** Scraper preview: result of POST /enrichment/scraper/scrape-next. */
export interface ScraperPreviewRow extends Record<string, unknown> {
  Id?: number;
  url?: string;
  _selection_bucket?: SelectionBucket | string | null;
}

export interface ScraperPreviewResponse {
  status: string;
  row?: ScraperPreviewRow | null;
  error?: string | null;
}

export type SelectionBucket =
  | 'manual_due'
  | 'manual_never'
  | 'auto_due'
  | 'auto_never'
  | 'auto_shallow_due'
  | 'auto_shallow_never';

export interface NextCandidates {
  pathfinder?: PathfinderPreviewResponse | null;
  scraper?: ScraperPreviewResponse | null;
  [k: string]: unknown;
}

export interface PipelineSummary {
  config?: PipelineConfig;
  schedule?: PipelineSchedule;
  last_jobs?: PipelineLastJobs;
  next_candidates?: NextCandidates;
  [k: string]: unknown;
}
```

- [ ] **Step 2: Extend `OpsDashboard.ts` to include `pipeline`, `error`, `message`**

Open `frontend/src/api/types/OpsDashboard.ts`. Add the import at the top:

```ts
import type { PipelineSummary } from './PipelineSummary';
```

Then add `pipeline?: PipelineSummary;` to `OpsDashboardResponse` (it already declares `error?` and `message?`, leave those alone). The interface should look like:

```ts
export interface OpsDashboardResponse {
  status: string;
  error?: string;
  message?: string;
  org_id: number;
  queue?: QueueStatus;
  runtime?: {
    tool_queue_ready?: boolean;
    huey?: HueyRuntime;
  };
  scheduler?: {
    running?: boolean;
    next_run?: string | null;
    next_enrichment_run?: string | null;
    agent_schedules?: SchedulerEntry[];
    enrichment_schedules?: SchedulerEntry[];
  };
  discovery?: {
    count?: number;
    rows?: Array<Record<string, unknown>>;
  };
  scrape_targets?: {
    count?: number;
    rows?: Array<Record<string, unknown>>;
  };
  queue_jobs?: {
    count?: number;
    rows?: QueueJob[];
  };
  active_summary?: {
    active?: number;
    queued?: number;
    running?: number;
    org_id?: number;
  };
  pipeline?: PipelineSummary;
}
```

- [ ] **Step 3: Type-check**

Run: `cd /Users/michaelturner/WebstormProjects/JeffGPT-gw-ui && npx tsc -p frontend --noEmit`
Expected: PASS (no output).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/api/types/PipelineSummary.ts frontend/src/api/types/OpsDashboard.ts
git commit -m "$(cat <<'EOF'
feat(types): extend ops dashboard types with pipeline summary

Adds PipelineSummary, NextCandidates, and preview response types so the
new ops UI can read pipeline.config / schedule / last_jobs /
next_candidates without resorting to `unknown` casts.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Gateway passthrough — POST /scrape-targets/:id/run-now and POST /jobs/:id/retry

**Files:**
- Modify: `gateway/src/routes/enrichment.ts`
- Modify: `gateway/src/routes/queue.ts`

- [ ] **Step 1: Add the run-now route in `enrichment.ts`**

Open `gateway/src/routes/enrichment.ts`. Insert this handler **after** the existing `enrichmentRoute.get('/scrape-targets/:id', …)` handler (so the static `/list` route still wins, and the dynamic `:id` resolves before our POST):

```ts
enrichmentRoute.post('/scrape-targets/:id/run-now', async (c) => {
  const id = c.req.param('id');
  try {
    const res = await harnessClient.post(
      `/enrichment/scrape-targets/${encodeURIComponent(id)}/run-now`,
      {},
      TIMEOUT,
    );
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'enrichment');
  }
});
```

- [ ] **Step 2: Add the retry route in `queue.ts`**

Open `gateway/src/routes/queue.ts`. Insert this handler **after** the existing `queueRoute.post('/jobs/:id/cancel', …)` handler:

```ts
queueRoute.post('/jobs/:id/retry', async (c) => {
  const id = c.req.param('id');
  try {
    const res = await harnessClient.post(
      `/tool-queue/jobs/${encodeURIComponent(id)}/retry`,
      {},
      TIMEOUT,
    );
    return forwardResponse(res);
  } catch (err) {
    return mapHarnessError(err, 'queue');
  }
});
```

- [ ] **Step 3: Type-check the gateway**

Run: `cd /Users/michaelturner/WebstormProjects/JeffGPT-gw-ui && npx tsc -p gateway --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add gateway/src/routes/enrichment.ts gateway/src/routes/queue.ts
git commit -m "$(cat <<'EOF'
feat(gateway): add run-now and retry passthroughs

Adds POST /api/enrichment/scrape-targets/:id/run-now and
POST /api/queue/jobs/:id/retry as thin proxies to the harness so the new
ops UI can trigger one-off scrapes and retry finished/failed/cancelled
jobs.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Frontend API client — runScrapeTargetNow + retryQueueJob

**Files:**
- Create: `frontend/src/api/enrichment/runScrapeTargetNow.ts`
- Create: `frontend/src/api/queue/retryQueueJob.ts`

- [ ] **Step 1: Create `runScrapeTargetNow.ts`**

```ts
// frontend/src/api/enrichment/runScrapeTargetNow.ts
import { http } from '../../lib/http';

export interface RunScrapeTargetNowResponse {
  status: 'queued' | 'failed' | string;
  target_id?: number;
  job_id?: string;
  org_id?: number;
  error?: string;
}

export function runScrapeTargetNow(targetId: number | string) {
  return http
    .post(`api/enrichment/scrape-targets/${encodeURIComponent(String(targetId))}/run-now`)
    .json<RunScrapeTargetNowResponse>();
}
```

- [ ] **Step 2: Create `retryQueueJob.ts`**

```ts
// frontend/src/api/queue/retryQueueJob.ts
import { http } from '../../lib/http';

export interface RetryQueueJobResponse {
  status: 'queued' | 'failed' | string;
  previous_job_id?: string;
  job_id?: string;
  type?: string;
  error?: string;
}

export function retryQueueJob(jobId: string) {
  return http
    .post(`api/queue/jobs/${encodeURIComponent(jobId)}/retry`)
    .json<RetryQueueJobResponse>();
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc -p frontend --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/api/enrichment/runScrapeTargetNow.ts frontend/src/api/queue/retryQueueJob.ts
git commit -m "$(cat <<'EOF'
feat(api): add runScrapeTargetNow and retryQueueJob clients

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Frontend API client — preview probes for pathfinder + scraper

**Files:**
- Create: `frontend/src/api/enrichment/fetchNextPathfinderSeed.ts`
- Create: `frontend/src/api/enrichment/fetchNextScraperTarget.ts`

We deliberately introduce new files instead of reusing the existing `fetchNextUrl` / `scrapeNext` helpers. The existing helpers are wired to "Pause" and other mutating flows in the standalone tabs; the new clients carry the typed preview response shape and are used only by the new ops screen.

- [ ] **Step 1: Create `fetchNextPathfinderSeed.ts`**

```ts
// frontend/src/api/enrichment/fetchNextPathfinderSeed.ts
import { http } from '../../lib/http';
import type { PathfinderPreviewResponse } from '../types/PipelineSummary';

export function fetchNextPathfinderSeed() {
  return http
    .post('api/enrichment/pathfinder/fetch-next')
    .json<PathfinderPreviewResponse>();
}
```

- [ ] **Step 2: Create `fetchNextScraperTarget.ts`**

```ts
// frontend/src/api/enrichment/fetchNextScraperTarget.ts
import { http } from '../../lib/http';
import type { ScraperPreviewResponse } from '../types/PipelineSummary';

export function fetchNextScraperTarget() {
  return http
    .post('api/enrichment/scraper/scrape-next')
    .json<ScraperPreviewResponse>();
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc -p frontend --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/api/enrichment/fetchNextPathfinderSeed.ts frontend/src/api/enrichment/fetchNextScraperTarget.ts
git commit -m "$(cat <<'EOF'
feat(api): add typed preview probes for pathfinder and scraper

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Shared lib — formatters and selectionBucket

**Files:**
- Create: `frontend/src/features/hub/tabs/ops/lib/formatters.ts`
- Create: `frontend/src/features/hub/tabs/ops/lib/selectionBucket.ts`

- [ ] **Step 1: Create `formatters.ts`**

```ts
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
```

- [ ] **Step 2: Create `selectionBucket.ts`**

```ts
// frontend/src/features/hub/tabs/ops/lib/selectionBucket.ts
import type { SelectionBucket } from '../../../../../api/types/PipelineSummary';

export interface BucketStyle {
  label: string;
  className: string;
}

const STYLES: Record<SelectionBucket, BucketStyle> = {
  manual_due:        { label: 'manual due',        className: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' },
  manual_never:      { label: 'manual new',        className: 'bg-blue-500/15 text-blue-300 border border-blue-500/30' },
  auto_due:          { label: 'auto due',          className: 'bg-amber-500/15 text-amber-300 border border-amber-500/30' },
  auto_never:        { label: 'auto new',          className: 'bg-violet-500/15 text-violet-300 border border-violet-500/30' },
  auto_shallow_due:  { label: 'auto shallow due',  className: 'bg-amber-500/15 text-amber-300 border border-amber-500/30' },
  auto_shallow_never:{ label: 'auto shallow new',  className: 'bg-violet-500/15 text-violet-300 border border-violet-500/30' },
};

export function bucketStyle(value: unknown): BucketStyle | null {
  if (typeof value !== 'string') return null;
  if (value in STYLES) return STYLES[value as SelectionBucket];
  return { label: value, className: 'bg-panel text-muted border border-border' };
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc -p frontend --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/hub/tabs/ops/lib/
git commit -m "$(cat <<'EOF'
feat(ops): add shared formatters and selection bucket helpers

Pulls the formatting and api-failure helpers out of the old OpsTab into
a shared lib so all ops sub-components share one implementation.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Primitive components — StatusChip, RelativeTime, HelpTooltip

**Files:**
- Create: `frontend/src/features/hub/tabs/ops/components/StatusChip.tsx`
- Create: `frontend/src/features/hub/tabs/ops/components/RelativeTime.tsx`
- Create: `frontend/src/features/hub/tabs/ops/components/HelpTooltip.tsx`

- [ ] **Step 1: Create `StatusChip.tsx`**

```tsx
// frontend/src/features/hub/tabs/ops/components/StatusChip.tsx

const PALETTE: Record<string, string> = {
  discovered: 'bg-blue-500/20 text-blue-300',
  scraped: 'bg-emerald-500/20 text-emerald-300',
  ok: 'bg-emerald-500/20 text-emerald-300',
  completed: 'bg-emerald-500/20 text-emerald-300',
  processed: 'bg-emerald-500/20 text-emerald-300',
  queued: 'bg-amber-500/20 text-amber-300',
  scraping: 'bg-violet-500/20 text-violet-300',
  running: 'bg-violet-500/20 text-violet-300',
  failed: 'bg-red-500/20 text-red-400',
  error: 'bg-red-500/20 text-red-400',
  cancelled: 'bg-panel text-muted',
  rejected: 'bg-amber-500/20 text-amber-300',
  idle: 'bg-panel text-muted',
  no_chunks: 'bg-panel text-muted',
  no_queries: 'bg-panel text-muted',
};

export interface StatusChipProps {
  status?: string | null;
  className?: string;
  title?: string;
}

export function StatusChip({ status, className, title }: StatusChipProps) {
  const label = status ?? 'unknown';
  const palette = (status && PALETTE[status]) ?? 'bg-panel text-muted';
  return (
    <span
      title={title}
      className={[
        'inline-block px-2 py-0.5 rounded text-[10px] uppercase tracking-[0.1em]',
        palette,
        className ?? '',
      ].join(' ')}
    >
      {label}
    </span>
  );
}
```

- [ ] **Step 2: Create `RelativeTime.tsx`**

```tsx
// frontend/src/features/hub/tabs/ops/components/RelativeTime.tsx
import { useEffect, useState } from 'react';
import { formatRelative, fmtWhen } from '../lib/formatters';

export interface RelativeTimeProps {
  iso?: string | null;
  /** Refresh cadence in ms. Default: 30s. */
  refreshMs?: number;
  /** When true, also render the absolute timestamp inline (small, after the relative bit). */
  showAbsolute?: boolean;
  className?: string;
}

export function RelativeTime({ iso, refreshMs = 30_000, showAbsolute, className }: RelativeTimeProps) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!iso) return;
    const id = window.setInterval(() => setTick((n) => n + 1), refreshMs);
    return () => window.clearInterval(id);
  }, [iso, refreshMs]);

  if (!iso) return <span className={className}>—</span>;
  return (
    <span className={className} title={fmtWhen(iso)}>
      {formatRelative(iso)}
      {showAbsolute && <span className="text-muted ml-1.5">({fmtWhen(iso)})</span>}
    </span>
  );
}
```

- [ ] **Step 3: Create `HelpTooltip.tsx`**

```tsx
// frontend/src/features/hub/tabs/ops/components/HelpTooltip.tsx
import { useState } from 'react';

export interface HelpTooltipProps {
  label?: string;
  children: React.ReactNode;
}

/**
 * Minimal CSS tooltip. Hover or focus the (i) glyph to expand the help text
 * inline below it. Click toggles persistence.
 */
export function HelpTooltip({ label = 'i', children }: HelpTooltipProps) {
  const [pinned, setPinned] = useState(false);
  return (
    <span className="relative inline-block group">
      <button
        type="button"
        onClick={() => setPinned((p) => !p)}
        aria-label="Help"
        className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-border text-[9px] uppercase text-muted hover:text-fg hover:border-fg"
      >
        {label}
      </button>
      <span
        role="tooltip"
        className={[
          'absolute z-20 left-0 top-full mt-1 w-72 p-2 rounded border border-border bg-panel/95 text-[11px] leading-snug text-fg shadow-lg',
          pinned ? 'block' : 'hidden group-hover:block group-focus-within:block',
        ].join(' ')}
      >
        {children}
      </span>
    </span>
  );
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc -p frontend --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/hub/tabs/ops/components/StatusChip.tsx frontend/src/features/hub/tabs/ops/components/RelativeTime.tsx frontend/src/features/hub/tabs/ops/components/HelpTooltip.tsx
git commit -m "$(cat <<'EOF'
feat(ops): add StatusChip, RelativeTime, HelpTooltip primitives

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Shared RowDrawer

**Files:**
- Create: `frontend/src/features/hub/tabs/ops/components/RowDrawer.tsx`

- [ ] **Step 1: Create `RowDrawer.tsx`**

```tsx
// frontend/src/features/hub/tabs/ops/components/RowDrawer.tsx
import { Sheet } from '../../../../../components/Sheet';
import { safeStringify } from '../lib/formatters';

export interface RowDrawerProps {
  open: boolean;
  onClose: () => void;
  /** e.g. "discovery", "target", "job" */
  kind: string;
  id: string;
  loading?: boolean;
  error?: string | null;
  data?: unknown;
  /** Optional rich rendering above the raw JSON section. */
  extra?: React.ReactNode;
}

export function RowDrawer({ open, onClose, kind, id, loading, error, data, extra }: RowDrawerProps) {
  return (
    <Sheet
      open={open}
      side="right"
      onClose={onClose}
      widthClass="w-[92vw] max-w-[760px]"
      mobileOnlyClass=""
      label="Detail drawer"
    >
      <div className="h-full flex flex-col">
        <div className="shrink-0 border-b border-border px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.16em] text-muted">
            {kind} / {id}
          </p>
        </div>
        <div className="flex-1 min-h-0 overflow-auto p-4 space-y-3">
          {loading && <p className="text-sm text-muted">Loading details...</p>}
          {error && <p className="text-xs text-red-500">{error}</p>}
          {!loading && !error && (
            <>
              {extra}
              <details open>
                <summary className="text-[11px] uppercase tracking-[0.14em] text-muted cursor-pointer">Raw JSON</summary>
                <pre className="mt-2 p-3 rounded border border-border bg-panel/60 text-xs whitespace-pre-wrap break-words">
                  {safeStringify(data)}
                </pre>
              </details>
            </>
          )}
        </div>
      </div>
    </Sheet>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -p frontend --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/hub/tabs/ops/components/RowDrawer.tsx
git commit -m "$(cat <<'EOF'
feat(ops): add shared RowDrawer for detail panes

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Hook — useOpsDashboard

**Files:**
- Create: `frontend/src/features/hub/tabs/ops/hooks/useOpsDashboard.ts`

- [ ] **Step 1: Create `useOpsDashboard.ts`**

```ts
// frontend/src/features/hub/tabs/ops/hooks/useOpsDashboard.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { getOpsDashboard } from '../../../../../api/ops/getOpsDashboard';
import { getQueueRuntime } from '../../../../../api/queue/getQueueRuntime';
import type { OpsDashboardResponse } from '../../../../../api/types/OpsDashboard';
import { gatewayUrl } from '../../../../../lib/runtime-env';
import type { QueueEvent } from '../../../../../api/types/QueueEvent';
import { extractApiFailure } from '../lib/formatters';

const DEBOUNCE_MS = 400;
const POLL_MS = 10_000;

export interface UseOpsDashboardResult {
  data: OpsDashboardResponse | null;
  loading: boolean;
  error: string | null;
  queueUnavailable: string | null;
  runtime: OpsDashboardResponse['runtime'] | undefined;
  reload: () => void;
  lastReloadedAt: number | null;
}

export function useOpsDashboard(orgId: number | null, limit = 20): UseOpsDashboardResult {
  const [data, setData] = useState<OpsDashboardResponse | null>(null);
  const [runtimeFallback, setRuntimeFallback] = useState<OpsDashboardResponse['runtime'] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queueUnavailable, setQueueUnavailable] = useState<string | null>(null);
  const [lastReloadedAt, setLastReloadedAt] = useState<number | null>(null);

  const debounceRef = useRef<number | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const pollRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    if (orgId == null) return;
    setLoading(true);
    setError(null);
    try {
      const next = await getOpsDashboard({ org_id: orgId, limit });
      if (next.status === 'failed' && next.error === 'tool_queue_unavailable') {
        setQueueUnavailable('Tool queue is unavailable. Start or restore the Huey consumer/runtime and retry.');
      } else {
        setQueueUnavailable(null);
      }
      setData(next);
      setLastReloadedAt(Date.now());
    } catch (err) {
      setError(extractApiFailure(err).message);
      try {
        const runtime = await getQueueRuntime();
        setRuntimeFallback({
          tool_queue_ready: runtime.tool_queue_ready,
          huey: runtime.huey,
        });
        if (runtime.tool_queue_ready === false || runtime.huey?.queue_ready === false) {
          setQueueUnavailable('Tool queue is unavailable. Verify Huey runtime and consumer are running.');
        }
      } catch {
        // Best-effort fallback.
      }
    } finally {
      setLoading(false);
    }
  }, [orgId, limit]);

  const scheduleRefresh = useCallback(() => {
    if (debounceRef.current != null) return;
    debounceRef.current = window.setTimeout(() => {
      debounceRef.current = null;
      void load();
    }, DEBOUNCE_MS);
  }, [load]);

  // Initial + orgId-driven load
  useEffect(() => {
    void load();
  }, [load]);

  // SSE subscription
  useEffect(() => {
    if (orgId == null) return;
    let active = true;

    function connect() {
      if (!active) return;
      const es = new EventSource(`${gatewayUrl()}/api/queue/events`, { withCredentials: true });
      esRef.current = es;
      es.onmessage = (e) => {
        try {
          const ev = JSON.parse(e.data) as QueueEvent;
          if (ev.type) scheduleRefresh();
        } catch {
          // keepalive / malformed payload — ignore
        }
      };
      es.onerror = () => {
        es.close();
        esRef.current = null;
        if (!active) return;
        window.setTimeout(connect, 2000);
      };
    }

    connect();
    return () => {
      active = false;
      esRef.current?.close();
      esRef.current = null;
      if (debounceRef.current != null) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [orgId, scheduleRefresh]);

  // Periodic poll, paused when tab is hidden.
  useEffect(() => {
    if (orgId == null) return;
    function tick() {
      if (document.visibilityState === 'visible') void load();
    }
    pollRef.current = window.setInterval(tick, POLL_MS);
    return () => {
      if (pollRef.current != null) window.clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [orgId, load]);

  return {
    data,
    loading,
    error,
    queueUnavailable,
    runtime: data?.runtime ?? runtimeFallback ?? undefined,
    reload: () => void load(),
    lastReloadedAt,
  };
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -p frontend --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/hub/tabs/ops/hooks/useOpsDashboard.ts
git commit -m "$(cat <<'EOF'
feat(ops): add useOpsDashboard hook with SSE + 10s polling

Single source of truth for the ops dashboard payload. Combines:
- initial fetch on org change
- SSE-driven debounced reload (~400 ms) on queue events
- periodic 10 s tick paused when the tab is hidden
- runtime probe fallback when the dashboard call fails outright

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Hook — useNextCandidatePreview

**Files:**
- Create: `frontend/src/features/hub/tabs/ops/hooks/useNextCandidatePreview.ts`

- [ ] **Step 1: Create `useNextCandidatePreview.ts`**

```ts
// frontend/src/features/hub/tabs/ops/hooks/useNextCandidatePreview.ts
import { useCallback, useEffect, useState } from 'react';
import { fetchNextPathfinderSeed } from '../../../../../api/enrichment/fetchNextPathfinderSeed';
import { fetchNextScraperTarget } from '../../../../../api/enrichment/fetchNextScraperTarget';
import type {
  PathfinderPreviewResponse,
  ScraperPreviewResponse,
} from '../../../../../api/types/PipelineSummary';
import { extractApiFailure } from '../lib/formatters';

export interface UseNextCandidatePreviewResult {
  pathfinder: PathfinderPreviewResponse | null;
  scraper: ScraperPreviewResponse | null;
  loadingPath: boolean;
  loadingScrape: boolean;
  errorPath: string | null;
  errorScrape: string | null;
  reevaluate: () => void;
  lastEvaluatedAt: number | null;
}

export function useNextCandidatePreview(orgId: number | null): UseNextCandidatePreviewResult {
  const [pathfinder, setPathfinder] = useState<PathfinderPreviewResponse | null>(null);
  const [scraper, setScraper] = useState<ScraperPreviewResponse | null>(null);
  const [loadingPath, setLoadingPath] = useState(false);
  const [loadingScrape, setLoadingScrape] = useState(false);
  const [errorPath, setErrorPath] = useState<string | null>(null);
  const [errorScrape, setErrorScrape] = useState<string | null>(null);
  const [lastEvaluatedAt, setLastEvaluatedAt] = useState<number | null>(null);

  const reevaluate = useCallback(() => {
    if (orgId == null) return;
    setLoadingPath(true);
    setErrorPath(null);
    void fetchNextPathfinderSeed()
      .then((r) => setPathfinder(r))
      .catch((err) => setErrorPath(extractApiFailure(err).message))
      .finally(() => setLoadingPath(false));

    setLoadingScrape(true);
    setErrorScrape(null);
    void fetchNextScraperTarget()
      .then((r) => setScraper(r))
      .catch((err) => setErrorScrape(extractApiFailure(err).message))
      .finally(() => {
        setLoadingScrape(false);
        setLastEvaluatedAt(Date.now());
      });
  }, [orgId]);

  // Fire once on mount/org change.
  useEffect(() => {
    if (orgId == null) return;
    reevaluate();
  }, [orgId, reevaluate]);

  return {
    pathfinder,
    scraper,
    loadingPath,
    loadingScrape,
    errorPath,
    errorScrape,
    reevaluate,
    lastEvaluatedAt,
  };
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -p frontend --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/hub/tabs/ops/hooks/useNextCandidatePreview.ts
git commit -m "$(cat <<'EOF'
feat(ops): add useNextCandidatePreview hook

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: PipelineCard

**Files:**
- Create: `frontend/src/features/hub/tabs/ops/components/PipelineCard.tsx`

- [ ] **Step 1: Create `PipelineCard.tsx`**

```tsx
// frontend/src/features/hub/tabs/ops/components/PipelineCard.tsx
import type {
  PipelineKind,
  PipelineKindConfig,
  PipelineKindSchedule,
  PipelineLastJob,
} from '../../../../../api/types/PipelineSummary';
import { fmt } from '../lib/formatters';
import { RelativeTime } from './RelativeTime';
import { StatusChip } from './StatusChip';

const TITLE: Record<PipelineKind, string> = {
  scraper: 'Scraper',
  pathfinder: 'Pathfinder',
  discover_agent: 'Discover-agent',
};

export interface PipelineCardProps {
  kind: PipelineKind;
  config?: PipelineKindConfig;
  schedule?: PipelineKindSchedule;
  lastJob?: PipelineLastJob | null;
  disabled?: boolean;
  busy?: boolean;
  onKick: () => void;
}

export function PipelineCard({
  kind,
  config,
  schedule,
  lastJob,
  disabled,
  busy,
  onKick,
}: PipelineCardProps) {
  const cadence =
    config?.interval_minutes != null ? `every ${config.interval_minutes}m` : '—';
  const enabledLabel = config?.enabled === false ? 'disabled' : 'enabled';

  return (
    <div className="border border-border rounded p-3 space-y-2 min-w-[14rem]">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.16em] text-muted">{TITLE[kind]}</p>
        <span className="text-[10px] uppercase tracking-[0.14em] text-muted">{enabledLabel}</span>
      </div>

      <div className="text-sm">
        <p className="text-muted text-[11px] uppercase tracking-[0.14em]">Cadence</p>
        <p className="text-fg">{cadence}</p>
      </div>

      <div className="text-sm">
        <p className="text-muted text-[11px] uppercase tracking-[0.14em]">Next run</p>
        <p className="text-fg">
          <RelativeTime iso={schedule?.next_run} showAbsolute />
        </p>
        {schedule?.cooldown_until && (
          <p className="text-amber-300 text-[11px]">
            cooldown until <RelativeTime iso={schedule.cooldown_until} />
          </p>
        )}
      </div>

      <div className="text-sm">
        <p className="text-muted text-[11px] uppercase tracking-[0.14em]">Last result</p>
        {lastJob ? (
          <div className="flex items-center gap-2 flex-wrap">
            <StatusChip status={lastJob.status ?? lastJob.result_status ?? 'unknown'} />
            <RelativeTime iso={lastJob.completed_at ?? lastJob.started_at} className="text-muted text-[11px]" />
            {lastJob.error && (
              <span className="text-red-400 text-[11px] truncate max-w-[10rem]" title={lastJob.error}>
                {fmt(lastJob.error)}
              </span>
            )}
          </div>
        ) : (
          <p className="text-muted">—</p>
        )}
      </div>

      <button
        type="button"
        onClick={onKick}
        disabled={disabled || busy}
        className="px-3 py-1.5 rounded border border-border text-[11px] uppercase tracking-[0.14em] hover:bg-panel disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {busy ? 'Kicking…' : 'Kick'}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -p frontend --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/hub/tabs/ops/components/PipelineCard.tsx
git commit -m "$(cat <<'EOF'
feat(ops): add PipelineCard component

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: PipelineRibbon

**Files:**
- Create: `frontend/src/features/hub/tabs/ops/components/PipelineRibbon.tsx`

- [ ] **Step 1: Create `PipelineRibbon.tsx`**

```tsx
// frontend/src/features/hub/tabs/ops/components/PipelineRibbon.tsx
import type { OpsDashboardResponse } from '../../../../../api/types/OpsDashboard';
import type { PipelineSummary } from '../../../../../api/types/PipelineSummary';
import type { QueueStatus } from '../../../../../api/types/QueueStatus';
import { PipelineCard } from './PipelineCard';
import { fmt } from '../lib/formatters';

export interface PipelineRibbonProps {
  pipeline?: PipelineSummary;
  runtime?: OpsDashboardResponse['runtime'];
  backoff?: QueueStatus['backoff'];
  triggersDisabled?: boolean;
  busy?: 'scraper' | 'pathfinder' | 'discover' | null;
  onKick: (kind: 'scraper' | 'pathfinder' | 'discover') => void;
}

export function PipelineRibbon({
  pipeline,
  runtime,
  backoff,
  triggersDisabled,
  busy,
  onKick,
}: PipelineRibbonProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
      <PipelineCard
        kind="scraper"
        config={pipeline?.config?.scraper}
        schedule={pipeline?.schedule?.scraper}
        lastJob={pipeline?.last_jobs?.scraper}
        disabled={triggersDisabled}
        busy={busy === 'scraper'}
        onKick={() => onKick('scraper')}
      />
      <PipelineCard
        kind="pathfinder"
        config={pipeline?.config?.pathfinder}
        schedule={pipeline?.schedule?.pathfinder}
        lastJob={pipeline?.last_jobs?.pathfinder}
        disabled={triggersDisabled}
        busy={busy === 'pathfinder'}
        onKick={() => onKick('pathfinder')}
      />
      <PipelineCard
        kind="discover_agent"
        config={pipeline?.config?.discover_agent}
        schedule={pipeline?.schedule?.discover_agent}
        lastJob={pipeline?.last_jobs?.discover_agent}
        disabled={triggersDisabled}
        busy={busy === 'discover'}
        onKick={() => onKick('discover')}
      />

      <div className="border border-border rounded p-3 space-y-2 min-w-[14rem]">
        <p className="text-[10px] uppercase tracking-[0.16em] text-muted">Queue and Huey</p>
        <p className="text-sm">tool_queue_ready: {fmt(runtime?.tool_queue_ready)}</p>
        <p className="text-sm">consumer: {runtime?.huey?.consumer_running ? 'running' : 'stopped'}</p>
        <p className="text-sm">workers: {fmt(runtime?.huey?.workers)}</p>
        <p className="text-sm">backoff: {fmt(backoff?.state)}</p>
        <p className="text-[11px] text-muted">idle: {fmt(backoff?.idle_seconds)}s</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -p frontend --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/hub/tabs/ops/components/PipelineRibbon.tsx
git commit -m "$(cat <<'EOF'
feat(ops): add PipelineRibbon composing the four header cards

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: NextCandidatePanel

**Files:**
- Create: `frontend/src/features/hub/tabs/ops/components/NextCandidatePanel.tsx`

- [ ] **Step 1: Create `NextCandidatePanel.tsx`**

```tsx
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
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -p frontend --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/hub/tabs/ops/components/NextCandidatePanel.tsx
git commit -m "$(cat <<'EOF'
feat(ops): add NextCandidatePanel with re-evaluate and help tooltips

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: DiscoveryPanel

**Files:**
- Create: `frontend/src/features/hub/tabs/ops/components/DiscoveryPanel.tsx`

- [ ] **Step 1: Create `DiscoveryPanel.tsx`**

```tsx
// frontend/src/features/hub/tabs/ops/components/DiscoveryPanel.tsx
import { useMemo, useState } from 'react';
import { getDiscoveryRow } from '../../../../../api/enrichment/getDiscoveryRow';
import type { OpsDashboardResponse } from '../../../../../api/types/OpsDashboard';
import { extractApiFailure, fmt, fmtWhen, rowIdFromAny, valueAt } from '../lib/formatters';
import { RowDrawer } from './RowDrawer';
import { StatusChip } from './StatusChip';
import { RelativeTime } from './RelativeTime';

type Filter = 'all' | 'new' | 'failed' | 'recent';

export interface DiscoveryPanelProps {
  discovery?: OpsDashboardResponse['discovery'];
  loading?: boolean;
}

export function DiscoveryPanel({ discovery, loading }: DiscoveryPanelProps) {
  const rows = (discovery?.rows ?? []) as Array<Record<string, unknown>>;
  const [filter, setFilter] = useState<Filter>('all');

  const filtered = useMemo(() => filterRows(rows, filter), [rows, filter]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerId, setDrawerId] = useState<string>('');
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerError, setDrawerError] = useState<string | null>(null);
  const [drawerData, setDrawerData] = useState<unknown>(null);

  async function openDrawer(id: string) {
    setDrawerId(id);
    setDrawerOpen(true);
    setDrawerLoading(true);
    setDrawerError(null);
    setDrawerData(null);
    try {
      const row = await getDiscoveryRow(id);
      setDrawerData(row);
    } catch (err) {
      setDrawerError(extractApiFailure(err).message);
    } finally {
      setDrawerLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <FilterChips
        value={filter}
        onChange={setFilter}
        options={[
          { id: 'all', label: 'All' },
          { id: 'new', label: 'New' },
          { id: 'failed', label: 'Failed' },
          { id: 'recent', label: 'Recently updated' },
        ]}
      />

      <div className="overflow-x-auto border border-border rounded">
        <table className="w-full text-sm font-sans">
          <thead className="bg-panel/50 text-[10px] uppercase tracking-[0.14em] text-muted">
            <tr>
              <th className="px-3 py-2 text-left">Id</th>
              <th className="px-3 py-2 text-left">URL</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Score</th>
              <th className="px-3 py-2 text-left">Depth</th>
              <th className="px-3 py-2 text-left">Source URL</th>
              <th className="px-3 py-2 text-left">Updated</th>
              <th className="px-3 py-2 text-left">Error</th>
              <th className="px-3 py-2 text-left">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((r, idx) => {
              const id = rowIdFromAny(r);
              return (
                <tr key={id ?? `disc-${idx}`} className="hover:bg-panel/30">
                  <td className="px-3 py-2">{fmt(id)}</td>
                  <td className="px-3 py-2 max-w-[24rem] truncate">{fmt(valueAt(r, 'url'))}</td>
                  <td className="px-3 py-2"><StatusChip status={String(valueAt(r, 'status') ?? '')} /></td>
                  <td className="px-3 py-2">{fmt(valueAt(r, 'score'))}</td>
                  <td className="px-3 py-2">{fmt(valueAt(r, 'depth'))}</td>
                  <td className="px-3 py-2 max-w-[18rem] truncate">{fmt(valueAt(r, 'source_url'))}</td>
                  <td className="px-3 py-2"><RelativeTime iso={(valueAt(r, 'UpdatedAt') ?? valueAt(r, 'CreatedAt')) as string | null | undefined} /></td>
                  <td className="px-3 py-2 max-w-[14rem] truncate">{fmt(valueAt(r, 'error_message'))}</td>
                  <td className="px-3 py-2">
                    {id ? (
                      <button
                        type="button"
                        onClick={() => void openDrawer(id)}
                        className="px-2 py-1 rounded border border-border text-[10px] uppercase tracking-[0.12em] hover:bg-panel"
                      >
                        Open
                      </button>
                    ) : (
                      <span className="text-muted text-xs">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-muted text-xs">
                  No discovery rows
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <RowDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        kind="discovery"
        id={drawerId}
        loading={drawerLoading}
        error={drawerError}
        data={drawerData}
      />
    </div>
  );
}

function filterRows(rows: Array<Record<string, unknown>>, filter: Filter) {
  if (filter === 'all') return rows;
  const now = Date.now();
  if (filter === 'recent') {
    return rows.filter((r) => {
      const t = Date.parse(String(valueAt(r, 'UpdatedAt') ?? valueAt(r, 'CreatedAt') ?? ''));
      return !Number.isNaN(t) && now - t < 24 * 3600 * 1000;
    });
  }
  if (filter === 'new') {
    return rows.filter((r) => valueAt(r, 'status') === 'discovered');
  }
  if (filter === 'failed') {
    return rows.filter((r) => valueAt(r, 'status') === 'failed');
  }
  return rows;
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
            value === o.id
              ? 'border-fg text-fg'
              : 'border-border text-muted hover:text-fg',
          ].join(' ')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -p frontend --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/hub/tabs/ops/components/DiscoveryPanel.tsx
git commit -m "$(cat <<'EOF'
feat(ops): add DiscoveryPanel with quick filters

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: ScrapeTargetsPanel

**Files:**
- Create: `frontend/src/features/hub/tabs/ops/components/ScrapeTargetsPanel.tsx`

- [ ] **Step 1: Create `ScrapeTargetsPanel.tsx`**

```tsx
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

type Filter = 'all' | 'due' | 'never' | 'auto' | 'manual' | 'failed' | 'unchanged';

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
  const filtered = useMemo(() => filterRows(rows, filter), [rows, filter]);

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
        <FilterChips
          value={filter}
          onChange={setFilter}
          options={[
            { id: 'all', label: 'All' },
            { id: 'due', label: 'Due now' },
            { id: 'never', label: 'Never scraped' },
            { id: 'auto', label: 'Auto' },
            { id: 'manual', label: 'Manual' },
            { id: 'failed', label: 'Failed' },
            { id: 'unchanged', label: 'Unchanged' },
          ]}
        />
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
                  <td className="px-3 py-2">{fmt(valueAt(r, 'consecutive_failures'))}</td>
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
      />
    </div>
  );
}

function filterRows(rows: Array<Record<string, unknown>>, filter: Filter) {
  if (filter === 'all') return rows;
  const now = Date.now();
  switch (filter) {
    case 'due':
      return rows.filter((r) => {
        const t = Date.parse(String(valueAt(r, 'next_crawl_at') ?? ''));
        return !Number.isNaN(t) && t <= now;
      });
    case 'never':
      return rows.filter((r) => !valueAt(r, 'last_scraped_at'));
    case 'auto':
      return rows.filter((r) => valueAt(r, 'auto_crawled') === 1);
    case 'manual':
      return rows.filter((r) => valueAt(r, 'auto_crawled') !== 1);
    case 'failed':
      return rows.filter((r) => valueAt(r, 'status') === 'error' || (valueAt(r, 'consecutive_failures') as number) > 0);
    case 'unchanged':
      return rows.filter((r) => (valueAt(r, 'consecutive_unchanged') as number) > 0);
  }
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
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -p frontend --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/hub/tabs/ops/components/ScrapeTargetsPanel.tsx
git commit -m "$(cat <<'EOF'
feat(ops): add ScrapeTargetsPanel with run-now action and bucket badge

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 15: QueueJobsPanel

**Files:**
- Create: `frontend/src/features/hub/tabs/ops/components/QueueJobsPanel.tsx`

- [ ] **Step 1: Create `QueueJobsPanel.tsx`**

```tsx
// frontend/src/features/hub/tabs/ops/components/QueueJobsPanel.tsx
import { useMemo, useState } from 'react';
import { cancelQueueJob } from '../../../../../api/queue/cancelQueueJob';
import { getQueueJob } from '../../../../../api/queue/getQueueJob';
import { retryQueueJob } from '../../../../../api/queue/retryQueueJob';
import { updateJobPriority } from '../../../../../api/queue/updateJobPriority';
import type { OpsDashboardResponse } from '../../../../../api/types/OpsDashboard';
import type { QueueJob } from '../../../../../api/types/QueueJob';
import { extractApiFailure, fmt, fmtWhen, safeStringify } from '../lib/formatters';
import { RowDrawer } from './RowDrawer';
import { StatusChip } from './StatusChip';

type Filter = 'all' | 'running' | 'failed' | 'waiting' | 'completed';

const RETRY_STATUSES: ReadonlySet<QueueJob['status']> = new Set(['completed', 'failed', 'cancelled']);

export interface QueueJobsPanelProps {
  queueJobs?: OpsDashboardResponse['queue_jobs'];
  triggersDisabled?: boolean;
  onActionComplete: () => void;
  loading?: boolean;
}

export function QueueJobsPanel({
  queueJobs,
  triggersDisabled,
  onActionComplete,
  loading,
}: QueueJobsPanelProps) {
  const rows = useMemo(() => queueJobs?.rows ?? [], [queueJobs]);
  const [filter, setFilter] = useState<Filter>('all');
  const filtered = useMemo(() => filterJobs(rows, filter), [rows, filter]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerId, setDrawerId] = useState<string>('');
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerError, setDrawerError] = useState<string | null>(null);
  const [drawerData, setDrawerData] = useState<QueueJob | null>(null);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  async function openDrawer(id: string) {
    setDrawerId(id);
    setDrawerOpen(true);
    setDrawerLoading(true);
    setDrawerError(null);
    setDrawerData(null);
    try {
      const job = await getQueueJob(id);
      setDrawerData(job);
    } catch (err) {
      setDrawerError(extractApiFailure(err).message);
    } finally {
      setDrawerLoading(false);
    }
  }

  async function withAction(id: string, fn: () => Promise<void>) {
    setBusyId(id);
    setActionMessage(null);
    try {
      await fn();
      onActionComplete();
    } catch (err) {
      setActionMessage(`error: ${extractApiFailure(err).message}`);
    } finally {
      setBusyId(null);
      window.setTimeout(() => setActionMessage(null), 6000);
    }
  }

  async function handleCancel(jobId: string) {
    await withAction(jobId, async () => {
      await cancelQueueJob(jobId);
      setActionMessage(`cancelled ${jobId}`);
    });
  }

  async function handleRetry(jobId: string) {
    await withAction(jobId, async () => {
      const res = await retryQueueJob(jobId);
      if (res.status === 'queued') {
        setActionMessage(`retried ${jobId} → ${res.job_id ?? '?'}`);
      } else {
        setActionMessage(`retry ${res.status}: ${res.error ?? ''}`);
      }
    });
  }

  async function handlePriority(job: QueueJob, delta: number) {
    const next = Math.min(5, Math.max(1, job.priority + delta));
    if (next === job.priority) return;
    await withAction(job.job_id, async () => {
      await updateJobPriority(job.job_id, next);
      setActionMessage(`priority ${job.job_id} → ${next}`);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <FilterChips
          value={filter}
          onChange={setFilter}
          options={[
            { id: 'all', label: 'All' },
            { id: 'running', label: 'Running' },
            { id: 'failed', label: 'Failed' },
            { id: 'waiting', label: 'Waiting' },
            { id: 'completed', label: 'Completed' },
          ]}
        />
        {actionMessage && (
          <span className="text-[11px] uppercase tracking-[0.14em] text-muted">{actionMessage}</span>
        )}
      </div>

      <div className="overflow-x-auto border border-border rounded">
        <table className="w-full text-sm font-sans">
          <thead className="bg-panel/50 text-[10px] uppercase tracking-[0.14em] text-muted">
            <tr>
              <th className="px-3 py-2 text-left">Job ID</th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Priority</th>
              <th className="px-3 py-2 text-left">Source</th>
              <th className="px-3 py-2 text-left">Task</th>
              <th className="px-3 py-2 text-left">Result</th>
              <th className="px-3 py-2 text-left">Error</th>
              <th className="px-3 py-2 text-left">Started</th>
              <th className="px-3 py-2 text-left">Completed</th>
              <th className="px-3 py-2 text-left">Claimed by</th>
              <th className="px-3 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((job) => (
              <tr key={job.job_id} className="hover:bg-panel/30">
                <td className="px-3 py-2 font-mono text-xs text-muted">{job.job_id.slice(0, 8)}</td>
                <td className="px-3 py-2">{job.type}</td>
                <td className="px-3 py-2"><StatusChip status={job.status} /></td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1">
                    {job.status === 'queued' && (
                      <button
                        type="button"
                        onClick={() => void handlePriority(job, 1)}
                        disabled={triggersDisabled || busyId === job.job_id}
                        className="w-5 h-5 rounded border border-border text-muted hover:text-fg hover:border-fg text-xs disabled:opacity-50"
                        title="Increase"
                      >
                        ↑
                      </button>
                    )}
                    <span className="tabular-nums w-4 text-center">{job.priority}</span>
                    {job.status === 'queued' && (
                      <button
                        type="button"
                        onClick={() => void handlePriority(job, -1)}
                        disabled={triggersDisabled || busyId === job.job_id}
                        className="w-5 h-5 rounded border border-border text-muted hover:text-fg hover:border-fg text-xs disabled:opacity-50"
                        title="Decrease"
                      >
                        ↓
                      </button>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2">{fmt(job.source)}</td>
                <td className="px-3 py-2 max-w-[18rem] truncate">{fmt(job.task)}</td>
                <td className="px-3 py-2">{fmt(job.result_status)}</td>
                <td className="px-3 py-2 max-w-[14rem] truncate">{fmt(job.error)}</td>
                <td className="px-3 py-2">{fmtWhen(job.started_at)}</td>
                <td className="px-3 py-2">{fmtWhen(job.completed_at)}</td>
                <td className="px-3 py-2">{fmt(job.claimed_by)}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1">
                    {(job.status === 'queued' || job.status === 'running') && (
                      <button
                        type="button"
                        onClick={() => void handleCancel(job.job_id)}
                        disabled={triggersDisabled || busyId === job.job_id}
                        className="px-2 py-1 rounded border border-red-600/40 text-red-400 text-[10px] uppercase tracking-[0.12em] hover:bg-red-600 hover:text-bg disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    )}
                    {RETRY_STATUSES.has(job.status) && (
                      <button
                        type="button"
                        onClick={() => void handleRetry(job.job_id)}
                        disabled={triggersDisabled || busyId === job.job_id}
                        className="px-2 py-1 rounded border border-border text-[10px] uppercase tracking-[0.12em] hover:bg-panel disabled:opacity-50"
                      >
                        Retry
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void openDrawer(job.job_id)}
                      className="px-2 py-1 rounded border border-border text-[10px] uppercase tracking-[0.12em] hover:bg-panel"
                    >
                      Open
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={12} className="px-3 py-6 text-center text-muted text-xs">
                  No jobs
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <RowDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        kind="job"
        id={drawerId}
        loading={drawerLoading}
        error={drawerError}
        data={drawerData}
        extra={
          drawerData ? (
            <>
              <details open>
                <summary className="text-[11px] uppercase tracking-[0.14em] text-muted cursor-pointer">Payload</summary>
                <pre className="mt-2 p-3 rounded border border-border bg-panel/60 text-xs whitespace-pre-wrap break-words">
                  {safeStringify(drawerData.payload)}
                </pre>
              </details>
              <details open>
                <summary className="text-[11px] uppercase tracking-[0.14em] text-muted cursor-pointer">Result</summary>
                <pre className="mt-2 p-3 rounded border border-border bg-panel/60 text-xs whitespace-pre-wrap break-words">
                  {safeStringify(drawerData.result)}
                </pre>
              </details>
            </>
          ) : null
        }
      />
    </div>
  );
}

function filterJobs(jobs: QueueJob[], filter: Filter) {
  switch (filter) {
    case 'all':
      return jobs;
    case 'running':
      return jobs.filter((j) => j.status === 'running');
    case 'failed':
      return jobs.filter((j) => j.status === 'failed');
    case 'waiting':
      return jobs.filter((j) => j.status === 'queued');
    case 'completed':
      return jobs.filter((j) => j.status === 'completed');
  }
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
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -p frontend --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/hub/tabs/ops/components/QueueJobsPanel.tsx
git commit -m "$(cat <<'EOF'
feat(ops): add QueueJobsPanel with retry/cancel/priority and payload drawer

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 16: OpsTab orchestrator

**Files:**
- Create: `frontend/src/features/hub/tabs/ops/OpsTab.tsx`

- [ ] **Step 1: Create the orchestrator**

```tsx
// frontend/src/features/hub/tabs/ops/OpsTab.tsx
import { useEffect, useState } from 'react';
import { orgMe } from '../../../../api/auth/orgMe';
import { startScraper } from '../../../../api/enrichment/scraper';
import { startPathfinder } from '../../../../api/enrichment/pathfinder';
import { startDiscoverAgent } from '../../../../api/enrichment/startDiscoverAgent';
import { extractApiFailure, asNumber, formatKick } from './lib/formatters';
import { useOpsDashboard } from './hooks/useOpsDashboard';
import { useNextCandidatePreview } from './hooks/useNextCandidatePreview';
import { PipelineRibbon } from './components/PipelineRibbon';
import { NextCandidatePanel } from './components/NextCandidatePanel';
import { DiscoveryPanel } from './components/DiscoveryPanel';
import { ScrapeTargetsPanel } from './components/ScrapeTargetsPanel';
import { QueueJobsPanel } from './components/QueueJobsPanel';

type SubTab = 'discovery' | 'scrape-targets' | 'queue';

function getOrgIdFromMe(payload: unknown): number | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as { org?: Record<string, unknown> };
  const org = p.org;
  if (!org) return null;
  return asNumber(org.id ?? org.Id ?? org.org_id);
}

export function OpsTab() {
  const [orgId, setOrgId] = useState<number | null>(null);
  const [orgInput, setOrgInput] = useState('');
  const [subTab, setSubTab] = useState<SubTab>('discovery');

  const dashboard = useOpsDashboard(orgId);
  const preview = useNextCandidatePreview(orgId);

  const [busyKick, setBusyKick] = useState<'scraper' | 'pathfinder' | 'discover' | null>(null);
  const [kickStatus, setKickStatus] = useState<string | null>(null);

  const triggersDisabled = !!dashboard.queueUnavailable;

  useEffect(() => {
    orgMe()
      .then((r) => {
        const id = getOrgIdFromMe(r);
        if (id != null) {
          setOrgId(id);
          setOrgInput(String(id));
        }
      })
      .catch(() => {});
  }, []);

  async function kick(kind: 'scraper' | 'pathfinder' | 'discover') {
    setBusyKick(kind);
    setKickStatus(null);
    try {
      const res =
        kind === 'scraper'
          ? await startScraper()
          : kind === 'pathfinder'
            ? await startPathfinder()
            : await startDiscoverAgent();
      setKickStatus(`${kind}: ${formatKick(res)}`);
      dashboard.reload();
    } catch (err) {
      setKickStatus(`${kind}: error ${extractApiFailure(err).message}`);
    } finally {
      setBusyKick(null);
      window.setTimeout(() => setKickStatus(null), 6000);
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-end gap-3 flex-wrap">
        <div>
          <label className="block text-[11px] uppercase tracking-[0.14em] text-muted mb-1.5">Org ID</label>
          <input
            value={orgInput}
            onChange={(e) => setOrgInput(e.target.value)}
            className="px-3 py-2 w-32 rounded border border-border bg-panel text-fg text-sm font-sans"
            placeholder="1"
          />
        </div>
        <button
          type="button"
          onClick={() => {
            const parsed = asNumber(orgInput);
            if (parsed != null) setOrgId(parsed);
          }}
          className="px-3 py-2 rounded border border-border text-[11px] uppercase tracking-[0.14em] hover:bg-panel"
        >
          Apply
        </button>
        <button
          type="button"
          onClick={() => dashboard.reload()}
          className="px-3 py-2 rounded border border-border text-[11px] uppercase tracking-[0.14em] hover:bg-panel"
        >
          Refresh
        </button>
        {kickStatus && (
          <span className="ml-auto text-[11px] uppercase tracking-[0.14em] text-muted">{kickStatus}</span>
        )}
      </div>

      {dashboard.queueUnavailable && (
        <div className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          <span className="font-medium">Queue service health:</span> {dashboard.queueUnavailable}
        </div>
      )}
      {dashboard.error && <p className="text-xs text-red-500">{dashboard.error}</p>}

      <PipelineRibbon
        pipeline={dashboard.data?.pipeline}
        runtime={dashboard.runtime}
        backoff={dashboard.data?.queue?.backoff}
        triggersDisabled={triggersDisabled}
        busy={busyKick}
        onKick={kick}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_22rem] gap-4">
        <div className="space-y-3 min-w-0">
          <nav className="flex gap-1 border-b border-border">
            {(['discovery', 'scrape-targets', 'queue'] as const).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setSubTab(id)}
                className={[
                  'px-3 py-2 text-[11px] uppercase tracking-[0.18em] font-sans border-b-2 -mb-px transition-colors',
                  subTab === id ? 'border-fg text-fg' : 'border-transparent text-muted hover:text-fg',
                ].join(' ')}
              >
                {id === 'discovery' ? 'Discovery' : id === 'scrape-targets' ? 'Scrape targets' : 'Queue jobs'}
              </button>
            ))}
          </nav>

          {subTab === 'discovery' && (
            <DiscoveryPanel discovery={dashboard.data?.discovery} loading={dashboard.loading} />
          )}
          {subTab === 'scrape-targets' && (
            <ScrapeTargetsPanel
              scrapeTargets={dashboard.data?.scrape_targets}
              scraperPreview={preview.scraper}
              triggersDisabled={triggersDisabled}
              onActionComplete={dashboard.reload}
              loading={dashboard.loading}
            />
          )}
          {subTab === 'queue' && (
            <QueueJobsPanel
              queueJobs={dashboard.data?.queue_jobs}
              triggersDisabled={triggersDisabled}
              onActionComplete={dashboard.reload}
              loading={dashboard.loading}
            />
          )}
        </div>

        <NextCandidatePanel
          pathfinder={preview.pathfinder}
          scraper={preview.scraper}
          loadingPath={preview.loadingPath}
          loadingScrape={preview.loadingScrape}
          errorPath={preview.errorPath}
          errorScrape={preview.errorScrape}
          lastEvaluatedAt={preview.lastEvaluatedAt}
          onReevaluate={preview.reevaluate}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -p frontend --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/hub/tabs/ops/OpsTab.tsx
git commit -m "$(cat <<'EOF'
feat(ops): add new OpsTab orchestrator

Composes the ribbon + 3 sub-tabs + sticky next-candidate side panel into
a single screen driven by useOpsDashboard and useNextCandidatePreview.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 17: Wire HubPage and remove the old OpsTab

**Files:**
- Modify: `frontend/src/features/hub/HubPage.tsx`
- Delete: `frontend/src/features/hub/tabs/OpsTab.tsx`

- [ ] **Step 1: Update the HubPage import**

In `frontend/src/features/hub/HubPage.tsx`, change line 10 from:

```ts
import { OpsTab } from './tabs/OpsTab';
```

to:

```ts
import { OpsTab } from './tabs/ops/OpsTab';
```

No other change in `HubPage.tsx` is needed — the JSX already references `<OpsTab />`.

- [ ] **Step 2: Delete the old OpsTab file**

```bash
git rm frontend/src/features/hub/tabs/OpsTab.tsx
```

- [ ] **Step 3: Type-check + build**

Run: `npx tsc -p frontend --noEmit && npm -w frontend run build`
Expected: PASS, then a Vite build with no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/hub/HubPage.tsx
git commit -m "$(cat <<'EOF'
feat(hub): switch OpsTab to the new ribbon+sub-tab+side-panel layout

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 18: Final verification

**Files:** none

- [ ] **Step 1: Type-check both packages**

Run: `npx tsc -p frontend --noEmit && npx tsc -p gateway --noEmit`
Expected: PASS for both, no output.

- [ ] **Step 2: Build both packages**

Run: `npm run build`
Expected: gateway tsc + Vite build complete without errors.

- [ ] **Step 3: Manual browser smoke**

Start the harness/gateway/frontend (per the project's existing dev recipe):

```bash
npm run dev:gateway   # in one shell
npm run dev:frontend  # in another
```

In a browser at http://localhost:5173, log in, navigate to **Hub → Ops** and verify:

- Pipeline ribbon shows three pipeline cards plus the Queue/Huey card with sensible values.
- Next candidate side panel shows pathfinder + scraper rows (or "No candidate selected right now"), and the Re-evaluate button refreshes both.
- Discovery sub-tab table renders rows; quick filter chips narrow the list.
- Scrape Targets sub-tab table renders rows. The bucket badge appears on the row matching the latest scraper preview. "Run now" returns a queued status message.
- Queue Jobs sub-tab table renders rows. Retry on a completed/failed/cancelled job shows the new job_id; Cancel works on a queued/running job; priority arrows update.
- When the harness is intentionally stopped, the queue-unavailable banner appears and all trigger buttons disable.

- [ ] **Step 4: Stop the dev servers and report results**

If anything in step 3 fails, file follow-up tasks rather than swallowing the failure. If everything passes, report completion.

---

## Self-Review

**1. Spec coverage:**

| Spec section | Implemented in |
| --- | --- |
| Pipeline ribbon (next/last per pipeline + queue health) | Tasks 10–11 |
| Next-candidate side panel + help tooltips + re-evaluate | Tasks 6, 9, 12 |
| Discovery sub-tab + quick filters | Tasks 5–7, 13 |
| Scrape targets sub-tab + Run-now + selection bucket | Tasks 1–5, 14 |
| Queue jobs sub-tab + Retry / Cancel / Priority | Tasks 3, 15 |
| `pipeline.config / schedule / last_jobs / next_candidates` types | Task 1 |
| Gateway passthroughs for run-now and retry | Task 2 |
| API clients for the new endpoints | Tasks 3–4 |
| SSE + 10 s polling + visibility pause | Task 8 |
| Queue-unavailable banner disabling triggers | Tasks 8, 16 |
| Status chip palette | Task 6 |
| Relative time | Task 6 |
| Edge cases (null candidate, unknown columns, retry shape, cancel on completed) | Tasks 12, 13–15 |
| Wiring into HubPage; old OpsTab removed | Task 17 |
| Type-check + build + manual smoke | Task 18 |

No spec section is unaccounted for.

**2. Placeholder scan:** Searched for "TBD", "TODO", "implement later", "appropriate", "similar to". None found. Every code step contains the actual implementation.

**3. Type consistency:**
- `PipelineKind` is consistently `'scraper' | 'pathfinder' | 'discover_agent'` everywhere it appears (PipelineSummary, PipelineCard, PipelineRibbon).
- The kick callback uses the abbreviated `'discover'` (matching the existing `startDiscoverAgent` API and current OpsTab behavior); the PipelineRibbon translates from card kind `'discover_agent'` to kick kind `'discover'` at the boundary in Task 11.
- `extractApiFailure` returns `{ message: string }` everywhere (formatters.ts and all consumers).
- `RetryQueueJobResponse` is defined once in `retryQueueJob.ts` and consumed only by `QueueJobsPanel.handleRetry`.
- `OpsDashboardResponse.pipeline` is added in Task 1 and consumed in Tasks 11, 12, 14, 16.

No naming drift.

---

## Notes for the executor

- This codebase has no frontend test framework. Do not add one as part of this plan; verification gates are TypeScript + Vite build + manual browser smoke.
- All commits go on the current branch (no worktree was created for this plan).
- If a step's commit fails on a pre-commit hook, fix the underlying issue and create a new commit (do not amend).