import { useEffect, useState } from 'react';
import {
  approveSuggestion,
  listSuggestions,
  pathfinderDiscover,
  rejectSuggestion,
} from '../../api/enrichment/suggestions';
import { listScrapeTargets } from '../../api/enrichment/scrapeTargets';
import { runScrapeTargetNow } from '../../api/enrichment/runScrapeTargetNow';
import { defaultOrgId } from '../../api/home/config';
import type { ScrapeTargetRow } from '../../api/types/Enrichment';
import type { Suggestion } from '../../api/types/Suggestion';
import { Btn, Empty, Eyebrow, PageHeader, StatusPill, TabRow, type TabDef } from '../../components/ui';
import { relTime } from '../../lib/utils/relTime';
import {
  fetchSourcesHealth,
  type SourceHealthDomain,
  type SourceHealthResponse,
} from '../../api/enrichment/sourcesHealth';

// Two-column operator console: Inbox (suggestions) on the left, the
// scrape-targets queue on the right, with a manual "submit a URL" form on
// top of the inbox so the old pathfinder-discover flow still works. Polls
// every 8s — the worker side is slow enough that more aggressive polling
// just burns NocoDB rate budget.
const POLL_MS = 8000;

type EnrichTab = 'console' | 'sources';
const ENRICH_TABS: ReadonlyArray<TabDef<EnrichTab>> = [
  { id: 'console', label: 'Console' },
  { id: 'sources', label: 'Sources' },
];

export function EnrichmentPage() {
  const [tab, setTab] = useState<EnrichTab>('console');
  return (
    <div className="h-full flex flex-col bg-bg text-fg font-sans">
      <PageHeader
        eyebrow="Operator console"
        title="Enrichment"
        right={<TabRow tabs={ENRICH_TABS} active={tab} onChange={setTab} size="sm" />}
      />

      {tab === 'console' ? (
        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border overflow-hidden">
          <InboxColumn />
          <QueueColumn />
        </div>
      ) : (
        <SourcesHealthView />
      )}
    </div>
  );
}

function SourcesHealthView() {
  const [data, setData] = useState<SourceHealthResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = () => {
    setLoading(true);
    setErr(null);
    fetchSourcesHealth(100)
      .then(setData)
      .catch((e) => setErr((e as Error).message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    void load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-8 py-5 space-y-5">
      <div className="flex items-baseline gap-4">
        <Eyebrow>per-domain scrape health</Eyebrow>
        {data && (
          <span className="text-xs text-muted font-mono">
            {data.total_domains} domains · {data.total_targets} targets
          </span>
        )}
        <Btn
          variant="ghost"
          onClick={load}
          disabled={loading}
          className="ml-auto text-[11px]"
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </Btn>
      </div>
      {err && (
        <div className="border border-red-200 bg-red-50 rounded-sm px-3 py-2 text-xs text-red-800">
          {err}
        </div>
      )}
      {!data && loading && <div className="text-xs text-muted">Loading source health…</div>}
      {data && data.domains.length === 0 && <Empty title="no sources yet" />}
      {data && data.domains.length > 0 && (
        <ul className="space-y-2">
          {data.domains.map((d) => (
            <SourceRow key={d.domain} d={d} />
          ))}
        </ul>
      )}
    </div>
  );
}

function SourceRow({ d }: { d: SourceHealthDomain }) {
  const [open, setOpen] = useState(false);
  const successPct =
    d.success_rate != null ? Math.round(d.success_rate * 100) : null;
  const tone =
    successPct == null
      ? 'text-muted'
      : successPct >= 90
      ? 'text-emerald-600'
      : successPct >= 60
      ? 'text-amber-600'
      : 'text-red-600';
  return (
    <li className="border border-border rounded-md bg-bg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left px-4 py-3 hover:bg-panel/50 transition-colors"
      >
        <div className="flex items-baseline gap-3">
          <h3 className="font-mono text-sm tracking-tight truncate flex-1">{d.domain}</h3>
          <span className={`font-mono text-[11px] ${tone}`}>
            {successPct == null ? '—' : `${successPct}%`} ok
          </span>
          <span className="font-mono text-[10px] text-muted">
            {d.active_targets}/{d.targets} active
          </span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] uppercase tracking-[0.16em] text-muted">
          <span>{d.chunks_total.toLocaleString()} chunks</span>
          {d.last_scraped_at && <span>last {relTime(d.last_scraped_at)}</span>}
          {d.errors > 0 && <span className="text-red-600">{d.errors} errors</span>}
          {d.consecutive_failures_total > 0 && (
            <span className="text-amber-600">
              {d.consecutive_failures_total} consec fails
            </span>
          )}
        </div>
      </button>
      {open && (
        <div className="px-4 py-3 border-t border-border bg-panel/30 space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
            <Cell label="ok" value={d.ok} />
            <Cell label="errors" value={d.errors} />
            <Cell label="rejected" value={d.rejected} />
            <Cell label="never scraped" value={d.never_scraped} />
          </div>
          {d.last_error && (
            <div className="text-[11px]">
              <Eyebrow className="mb-1">last error</Eyebrow>
              <code className="block bg-panel/60 px-2 py-1.5 rounded-sm text-fg/85 break-words">
                {d.last_error}
              </code>
            </div>
          )}
          {d.errors_recent.length > 0 && (
            <div className="text-[11px]">
              <Eyebrow className="mb-1">recent errors</Eyebrow>
              <ul className="space-y-0.5">
                {d.errors_recent.map((e, i) => (
                  <li key={i} className="font-mono text-fg/80 truncate">
                    <span className="text-muted mr-2">{e.error}</span>
                    {e.url}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function Cell({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-[0.16em] text-muted">{label}</div>
      <div className="font-mono text-sm">{value.toLocaleString()}</div>
    </div>
  );
}

function InboxColumn() {
  const [items, setItems] = useState<Suggestion[] | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [seedUrl, setSeedUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);

  const load = () =>
    listSuggestions({ org_id: defaultOrgId(), status: 'pending', limit: 100 })
      .then((r) => setItems(r.rows))
      .catch(() => setItems([]));

  useEffect(() => {
    void load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, []);

  const decide = async (id: number, decision: 'approve' | 'reject') => {
    setBusy(id);
    try {
      if (decision === 'approve') await approveSuggestion(id);
      else await rejectSuggestion(id);
      await load();
    } finally {
      setBusy(null);
    }
  };

  const submit = async () => {
    const url = seedUrl.trim();
    if (!url || !url.startsWith('http')) {
      setSubmitMsg('Enter an http(s) URL.');
      return;
    }
    setSubmitting(true);
    setSubmitMsg(null);
    try {
      const res = await pathfinderDiscover(url, defaultOrgId());
      if (res.status === 'queued') {
        setSubmitMsg(`Queued (suggested_id=${res.suggested_id}).`);
        setSeedUrl('');
        await load();
      } else {
        setSubmitMsg(res.error || 'Failed.');
      }
    } catch (e) {
      setSubmitMsg((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="flex flex-col min-h-0 overflow-hidden">
      <header className="px-5 sm:px-7 pt-4 pb-3 border-b border-border">
        <div className="flex items-baseline gap-2">
          <Eyebrow>Inbox</Eyebrow>
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted">
            suggested scrape targets · pending review
          </span>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <input
            type="text"
            placeholder="Submit a URL — sends straight to pathfinder"
            value={seedUrl}
            onChange={(e) => setSeedUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !submitting) void submit();
            }}
            className="flex-1 px-3 py-1.5 text-sm font-mono border border-border rounded-sm bg-bg focus:outline-none focus:border-fg"
          />
          <Btn
            variant="primary"
            size="sm"
            onClick={() => void submit()}
            disabled={submitting || !seedUrl.trim()}
          >
            {submitting ? 'Submitting…' : 'Submit'}
          </Btn>
        </div>
        {submitMsg && (
          <div className="mt-1.5 text-[11px] text-muted">{submitMsg}</div>
        )}
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-2">
        {items == null ? (
          <div className="text-xs text-muted">Loading…</div>
        ) : items.length === 0 ? (
          <Empty title="all caught up" hint="No pending suggestions." />
        ) : (
          items.map((s) => (
            <SuggestionCard
              key={s.Id}
              row={s}
              busy={busy === s.Id}
              onApprove={() => void decide(s.Id, 'approve')}
              onReject={() => void decide(s.Id, 'reject')}
            />
          ))
        )}
      </div>
    </section>
  );
}

function SuggestionCard({
  row,
  busy,
  onApprove,
  onReject,
}: {
  row: Suggestion;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const source = sourceOf(row);
  return (
    <article className="border border-border rounded-md bg-bg p-3 hover:border-fg/40 transition-colors">
      <div className="flex items-baseline justify-between gap-2">
        <SourceBadge source={source} />
        <div className="text-[10px] text-muted font-mono">{relTime(row.CreatedAt)}</div>
      </div>
      <div className="mt-1 font-mono text-xs text-fg/85 truncate" title={row.url}>
        {row.url}
      </div>
      {row.title && row.title !== row.url && (
        <div className="text-sm font-display mt-0.5 truncate">{row.title}</div>
      )}
      {row.reason && (
        <p className="text-xs text-muted mt-1.5 line-clamp-2">{row.reason}</p>
      )}
      <div className="flex gap-1.5 mt-2.5 items-center">
        <Btn size="sm" variant="primary" onClick={onApprove} disabled={busy}>
          Approve
        </Btn>
        <Btn size="sm" variant="danger" onClick={onReject} disabled={busy}>
          Reject
        </Btn>
        <span className="ml-auto text-[10px] text-muted font-mono">
          score {row.score ?? '—'} · {row.relevance ?? '—'}
        </span>
      </div>
    </article>
  );
}

// `source` isn't a column on suggested_scrape_targets; we infer it the same
// way the backend's _suggestion_source_tag does so the UI can show provenance
// without a second request.
type Source = 'harvest' | 'manual' | 'discover_agent';
function sourceOf(row: Suggestion): Source {
  const q = row.query ?? '';
  const reason = row.reason ?? '';
  if (q.startsWith('harvest:') || /harvest run/i.test(reason)) return 'harvest';
  if (q === 'manual_entry' || /user-submitted/i.test(reason)) return 'manual';
  return 'discover_agent';
}

function SourceBadge({ source }: { source: Source }) {
  const label = source === 'discover_agent' ? 'agent' : source;
  const tone =
    source === 'harvest'
      ? 'border-sky-300 text-sky-800 bg-sky-50'
      : source === 'manual'
      ? 'border-emerald-300 text-emerald-800 bg-emerald-50'
      : 'border-border text-fg bg-panel';
  return (
    <span
      className={`px-1.5 py-px font-mono text-[9px] uppercase tracking-[0.16em] border rounded-sm ${tone}`}
    >
      {label}
    </span>
  );
}

function QueueColumn() {
  const [rows, setRows] = useState<ScrapeTargetRow[] | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const load = () =>
    listScrapeTargets({ active_only: true, limit: 200, sort_by: 'next_crawl_at', sort_dir: 'asc' })
      .then((r) => setRows(r.rows))
      .catch(() => setRows([]));

  useEffect(() => {
    void load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, []);

  const runNow = async (id: number) => {
    setBusy(id);
    try {
      await runScrapeTargetNow(id);
      await load();
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="flex flex-col min-h-0 overflow-hidden">
      <header className="px-5 sm:px-7 pt-4 pb-3 border-b border-border">
        <div className="flex items-baseline gap-2">
          <Eyebrow>Queue</Eyebrow>
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted">
            scrape targets · approved
          </span>
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3">
        {rows == null ? (
          <div className="text-xs text-muted px-2">Loading…</div>
        ) : rows.length === 0 ? (
          <Empty title="empty queue" hint="Approve a suggestion to queue it." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.18em] text-muted border-b border-border">
                <th className="text-left py-2 w-24">status</th>
                <th className="text-left py-2">url</th>
                <th className="text-right py-2 w-24">last</th>
                <th className="text-right py-2 w-24">next</th>
                <th className="text-right py-2 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.Id} className="border-b border-border">
                  <td className="py-2">
                    <StatusPill status={r.status ?? 'queued'} />
                  </td>
                  <td className="py-2 text-xs font-mono text-fg/85 truncate" title={r.url}>
                    <span className="block truncate" style={{ maxWidth: '36ch' }}>
                      {r.url}
                    </span>
                  </td>
                  <td className="py-2 text-right text-xs text-muted">
                    {r.last_scraped_at ? relTime(r.last_scraped_at) : '—'}
                  </td>
                  <td className="py-2 text-right text-xs text-muted">
                    {r.next_crawl_at ? relTime(r.next_crawl_at) : '—'}
                  </td>
                  <td className="py-2 text-right">
                    <Btn size="sm" onClick={() => void runNow(r.Id)} disabled={busy === r.Id}>
                      {busy === r.Id ? '…' : 'Run'}
                    </Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
