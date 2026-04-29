import { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type {
  ResearchArtifacts,
  ResearchOpKind,
  ResearchPlan,
} from '../../../../api/types/Enrichment';

const SOURCE_RE = /\[Source:\s*(https?:\/\/[^\s\]]+)\s*\]/gi;
const HEADING_RE = /^##\s+(.+)$/gm;
const SOURCES_BLOCK_RE = /^##\s+Sources\s*$([\s\S]*?)(?=^##\s|\Z)/im;

export interface ParsedSource {
  title: string;
  url: string;
  usageCount: number;
}

export interface OpInvocation {
  kind: ResearchOpKind | 'review';
  params?: Record<string, unknown>;
}

interface OperationsPanelProps {
  plan: ResearchPlan;
  artifacts: ResearchArtifacts;
  onInvoke: (op: OpInvocation) => Promise<unknown>;
  onStartChat: () => Promise<unknown>;
  onRunReview: (instructions?: string) => Promise<unknown>;
  onRefreshArtifacts: () => Promise<unknown>;
  /** kind currently in flight (or null). */
  busyKind: string | null;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

type TabKey = 'refine' | 'sources' | 'artifacts' | 'chat';

const AUDIENCE_CHIPS = [
  'non-technical executive',
  'investor',
  'engineer',
  'regulator',
  'academic',
  'founder',
  'policy maker',
];

export function OperationsPanel(props: OperationsPanelProps) {
  const [tab, setTab] = useState<TabKey>('refine');
  const sections = useMemo(
    () => extractSectionTitles(props.plan.paper_content ?? ''),
    [props.plan.paper_content],
  );
  const sources = useMemo(
    () => extractSources(props.plan.paper_content ?? ''),
    [props.plan.paper_content],
  );
  const wordCount = useMemo(
    () => countWords(props.plan.paper_content ?? ''),
    [props.plan.paper_content],
  );

  if (props.collapsed) {
    return (
      <div className="sticky top-[calc(64px+1rem)] flex justify-end">
        <button
          onClick={props.onToggleCollapse}
          className="px-3 py-1.5 rounded border border-border text-[10px] uppercase tracking-[0.14em] hover:bg-panel"
        >
          Operations →
        </button>
      </div>
    );
  }

  return (
    <aside className="sticky top-0 self-start max-h-[calc(100vh-2rem)] overflow-y-auto border-l border-border bg-bg">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex gap-1">
          {(['refine', 'sources', 'artifacts', 'chat'] as TabKey[]).map((k) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`px-2.5 py-1 rounded text-[10px] uppercase tracking-[0.14em] ${
                tab === k
                  ? 'bg-fg text-bg'
                  : 'text-muted hover:bg-panel hover:text-fg'
              }`}
            >
              {k}
            </button>
          ))}
        </div>
        <button
          onClick={props.onToggleCollapse}
          className="text-muted hover:text-fg text-sm leading-none"
          aria-label="Collapse"
          title="Collapse"
        >
          ›
        </button>
      </div>
      <div className="p-4 space-y-3">
        {tab === 'refine' && (
          <RefineTab
            sections={sections}
            wordCount={wordCount}
            busyKind={props.busyKind}
            onInvoke={props.onInvoke}
            onRunReview={props.onRunReview}
          />
        )}
        {tab === 'sources' && (
          <SourcesTab
            sources={sources}
            busyKind={props.busyKind}
            onRunAudit={() => props.onInvoke({ kind: 'citation_audit' })}
          />
        )}
        {tab === 'artifacts' && (
          <ArtifactsTab
            artifacts={props.artifacts}
            busyKind={props.busyKind}
            onInvoke={props.onInvoke}
            onRefresh={props.onRefreshArtifacts}
          />
        )}
        {tab === 'chat' && (
          <ChatTab
            busyKind={props.busyKind}
            onStart={props.onStartChat}
          />
        )}
      </div>
    </aside>
  );
}

// ---------- Refine ----------

function RefineTab({
  sections,
  wordCount,
  busyKind,
  onInvoke,
  onRunReview,
}: {
  sections: string[];
  wordCount: number;
  busyKind: string | null;
  onInvoke: OperationsPanelProps['onInvoke'];
  onRunReview: OperationsPanelProps['onRunReview'];
}) {
  return (
    <div className="space-y-2.5">
      <ReviewCard busy={busyKind === 'review'} onRun={onRunReview} />
      <SimpleCard
        title="Fact-check"
        desc="Verify each claim against its citation."
        action="Run fact-check"
        busy={busyKind === 'fact_check'}
        onRun={() => onInvoke({ kind: 'fact_check' })}
      />
      <SimpleCard
        title="Citation audit"
        desc="Find orphan citations and unused sources."
        action="Run audit"
        busy={busyKind === 'citation_audit'}
        onRun={() => onInvoke({ kind: 'citation_audit' })}
      />
      <ExpandSectionCard sections={sections} busyKind={busyKind} onInvoke={onInvoke} />
      <AddSectionCard sections={sections} busyKind={busyKind} onInvoke={onInvoke} />
      <SimpleCard
        title="Counter-arguments"
        desc="Add a steel-manned opposition section."
        action="Add section"
        busy={busyKind === 'counter_arguments'}
        onRun={() => onInvoke({ kind: 'counter_arguments' })}
      />
      <FreshSourcesCard busyKind={busyKind} onInvoke={onInvoke} />
      <RecencyCard busyKind={busyKind} onInvoke={onInvoke} />
      <ReframeCard busyKind={busyKind} onInvoke={onInvoke} />
      <ResizeCard wordCount={wordCount} busyKind={busyKind} onInvoke={onInvoke} />
    </div>
  );
}

function CardShell({
  title,
  desc,
  children,
}: {
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-border rounded bg-panel/40 p-3 space-y-2">
      <div>
        <p className="text-[12px] font-semibold text-fg">{title}</p>
        <p className="text-[11px] text-muted">{desc}</p>
      </div>
      {children}
    </div>
  );
}

function SimpleCard({
  title,
  desc,
  action,
  busy,
  onRun,
}: {
  title: string;
  desc: string;
  action: string;
  busy: boolean;
  onRun: () => void;
}) {
  return (
    <CardShell title={title} desc={desc}>
      <button
        disabled={busy}
        onClick={() => onRun()}
        className="px-3 py-1 rounded border border-border text-[10px] uppercase tracking-[0.14em] hover:bg-panel disabled:opacity-50"
      >
        {busy ? 'Running…' : action}
      </button>
    </CardShell>
  );
}

function ReviewCard({
  busy,
  onRun,
}: {
  busy: boolean;
  onRun: (instructions?: string) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState('');
  return (
    <CardShell
      title="Review"
      desc="Run a critic pass over the paper. Any notes get fed in."
    >
      {open ? (
        <div className="space-y-2">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Optional reviewer notes"
            className="w-full text-[12px] bg-bg border border-border rounded px-2 py-1 font-mono"
          />
          <div className="flex gap-2">
            <button
              disabled={busy}
              onClick={async () => {
                await onRun(notes.trim() || undefined);
                setOpen(false);
              }}
              className="px-3 py-1 rounded border border-fg bg-fg text-bg text-[10px] uppercase tracking-[0.14em] disabled:opacity-50"
            >
              {busy ? 'Running…' : 'Run review'}
            </button>
            <button
              onClick={() => setOpen(false)}
              className="px-3 py-1 rounded border border-border text-[10px] uppercase tracking-[0.14em] hover:bg-panel"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          disabled={busy}
          onClick={() => setOpen(true)}
          className="px-3 py-1 rounded border border-border text-[10px] uppercase tracking-[0.14em] hover:bg-panel disabled:opacity-50"
        >
          {busy ? 'Running…' : 'Run review'}
        </button>
      )}
    </CardShell>
  );
}

function ExpandSectionCard({
  sections,
  busyKind,
  onInvoke,
}: {
  sections: string[];
  busyKind: string | null;
  onInvoke: OperationsPanelProps['onInvoke'];
}) {
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState(sections[0] ?? '');
  const [target, setTarget] = useState(1800);
  const busy = busyKind === 'expand_section';
  return (
    <CardShell title="Expand section" desc="Make a section deeper, with new sources.">
      {open ? (
        <div className="space-y-2">
          <select
            value={section}
            onChange={(e) => setSection(e.target.value)}
            className="w-full text-[12px] bg-bg border border-border rounded px-2 py-1"
          >
            {sections.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <div>
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted mb-1">
              Target words: <span className="font-mono text-fg">{target}</span>
            </p>
            <input
              type="range"
              min={800}
              max={4000}
              step={100}
              value={target}
              onChange={(e) => setTarget(Number(e.target.value))}
              className="w-full"
            />
          </div>
          <div className="flex gap-2">
            <button
              disabled={busy || !section}
              onClick={async () => {
                await onInvoke({
                  kind: 'expand_section',
                  params: { section_title: section, target_words: target },
                });
                setOpen(false);
              }}
              className="px-3 py-1 rounded border border-fg bg-fg text-bg text-[10px] uppercase tracking-[0.14em] disabled:opacity-50"
            >
              {busy ? 'Running…' : 'Expand'}
            </button>
            <button
              onClick={() => setOpen(false)}
              className="px-3 py-1 rounded border border-border text-[10px] uppercase tracking-[0.14em] hover:bg-panel"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          disabled={busy || sections.length === 0}
          onClick={() => setOpen(true)}
          className="px-3 py-1 rounded border border-border text-[10px] uppercase tracking-[0.14em] hover:bg-panel disabled:opacity-50"
        >
          {busy ? 'Running…' : 'Expand…'}
        </button>
      )}
    </CardShell>
  );
}

function AddSectionCard({
  sections,
  busyKind,
  onInvoke,
}: {
  sections: string[];
  busyKind: string | null;
  onInvoke: OperationsPanelProps['onInvoke'];
}) {
  const [open, setOpen] = useState(false);
  const [heading, setHeading] = useState('');
  const [brief, setBrief] = useState('');
  const [after, setAfter] = useState<string>('');
  const [target, setTarget] = useState(1000);
  const busy = busyKind === 'add_section';
  return (
    <CardShell title="Add section" desc="Insert a new section anywhere in the paper.">
      {open ? (
        <div className="space-y-2">
          <input
            value={heading}
            onChange={(e) => setHeading(e.target.value)}
            placeholder="Heading"
            className="w-full text-[12px] bg-bg border border-border rounded px-2 py-1"
          />
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            rows={3}
            placeholder="Brief — what should this section cover?"
            className="w-full text-[12px] bg-bg border border-border rounded px-2 py-1 font-mono"
          />
          <select
            value={after}
            onChange={(e) => setAfter(e.target.value)}
            className="w-full text-[12px] bg-bg border border-border rounded px-2 py-1"
          >
            <option value="">Insert at end</option>
            {sections.map((s) => (
              <option key={s} value={s}>
                After: {s}
              </option>
            ))}
          </select>
          <div>
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted mb-1">
              Target words: <span className="font-mono text-fg">{target}</span>
            </p>
            <input
              type="range"
              min={400}
              max={3000}
              step={100}
              value={target}
              onChange={(e) => setTarget(Number(e.target.value))}
              className="w-full"
            />
          </div>
          <div className="flex gap-2">
            <button
              disabled={busy || !heading.trim() || !brief.trim()}
              onClick={async () => {
                await onInvoke({
                  kind: 'add_section',
                  params: {
                    heading: heading.trim(),
                    brief: brief.trim(),
                    after_section: after || undefined,
                    target_words: target,
                  },
                });
                setOpen(false);
                setHeading('');
                setBrief('');
              }}
              className="px-3 py-1 rounded border border-fg bg-fg text-bg text-[10px] uppercase tracking-[0.14em] disabled:opacity-50"
            >
              {busy ? 'Running…' : 'Add'}
            </button>
            <button
              onClick={() => setOpen(false)}
              className="px-3 py-1 rounded border border-border text-[10px] uppercase tracking-[0.14em] hover:bg-panel"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          disabled={busy}
          onClick={() => setOpen(true)}
          className="px-3 py-1 rounded border border-border text-[10px] uppercase tracking-[0.14em] hover:bg-panel disabled:opacity-50"
        >
          {busy ? 'Running…' : 'Add section…'}
        </button>
      )}
    </CardShell>
  );
}

function FreshSourcesCard({
  busyKind,
  onInvoke,
}: {
  busyKind: string | null;
  onInvoke: OperationsPanelProps['onInvoke'];
}) {
  const [open, setOpen] = useState(false);
  const [queries, setQueries] = useState('');
  const busy = busyKind === 'add_fresh_sources';
  return (
    <CardShell
      title="Add fresh sources"
      desc="Run new web searches and append a section synthesised from them."
    >
      {open ? (
        <div className="space-y-2">
          <textarea
            value={queries}
            onChange={(e) => setQueries(e.target.value)}
            rows={4}
            placeholder="One query per line. Leave blank to let the planner generate four."
            className="w-full text-[12px] bg-bg border border-border rounded px-2 py-1 font-mono"
          />
          <div className="flex gap-2">
            <button
              disabled={busy}
              onClick={async () => {
                const list = queries
                  .split('\n')
                  .map((q) => q.trim())
                  .filter(Boolean);
                await onInvoke({
                  kind: 'add_fresh_sources',
                  params: list.length > 0 ? { queries: list } : {},
                });
                setOpen(false);
              }}
              className="px-3 py-1 rounded border border-fg bg-fg text-bg text-[10px] uppercase tracking-[0.14em] disabled:opacity-50"
            >
              {busy ? 'Running…' : 'Add sources'}
            </button>
            <button
              onClick={() => setOpen(false)}
              className="px-3 py-1 rounded border border-border text-[10px] uppercase tracking-[0.14em] hover:bg-panel"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          disabled={busy}
          onClick={() => setOpen(true)}
          className="px-3 py-1 rounded border border-border text-[10px] uppercase tracking-[0.14em] hover:bg-panel disabled:opacity-50"
        >
          {busy ? 'Running…' : 'Add fresh sources…'}
        </button>
      )}
    </CardShell>
  );
}

function RecencyCard({
  busyKind,
  onInvoke,
}: {
  busyKind: string | null;
  onInvoke: OperationsPanelProps['onInvoke'];
}) {
  const [open, setOpen] = useState(false);
  const [since, setSince] = useState(String(new Date().getFullYear()));
  const busy = busyKind === 'refresh_recency';
  return (
    <CardShell
      title="Refresh for recency"
      desc='Re-search with "since {date}" filters and add what is new.'
    >
      {open ? (
        <div className="space-y-2">
          <input
            value={since}
            onChange={(e) => setSince(e.target.value)}
            placeholder="2026 or 2025-06"
            className="w-full text-[12px] bg-bg border border-border rounded px-2 py-1 font-mono"
          />
          <div className="flex gap-2">
            <button
              disabled={busy || !since.trim()}
              onClick={async () => {
                await onInvoke({
                  kind: 'refresh_recency',
                  params: { since_date: since.trim() },
                });
                setOpen(false);
              }}
              className="px-3 py-1 rounded border border-fg bg-fg text-bg text-[10px] uppercase tracking-[0.14em] disabled:opacity-50"
            >
              {busy ? 'Running…' : 'Refresh'}
            </button>
            <button
              onClick={() => setOpen(false)}
              className="px-3 py-1 rounded border border-border text-[10px] uppercase tracking-[0.14em] hover:bg-panel"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          disabled={busy}
          onClick={() => setOpen(true)}
          className="px-3 py-1 rounded border border-border text-[10px] uppercase tracking-[0.14em] hover:bg-panel disabled:opacity-50"
        >
          {busy ? 'Running…' : 'Refresh…'}
        </button>
      )}
    </CardShell>
  );
}

function ReframeCard({
  busyKind,
  onInvoke,
}: {
  busyKind: string | null;
  onInvoke: OperationsPanelProps['onInvoke'];
}) {
  const [open, setOpen] = useState(false);
  const [audience, setAudience] = useState('');
  const busy = busyKind === 'reframe';
  return (
    <CardShell
      title="Reframe for audience"
      desc="Rewrite the paper for a different reader. Facts preserved."
    >
      {open ? (
        <div className="space-y-2">
          <input
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            placeholder="Audience"
            className="w-full text-[12px] bg-bg border border-border rounded px-2 py-1"
          />
          <div className="flex flex-wrap gap-1">
            {AUDIENCE_CHIPS.map((a) => (
              <button
                key={a}
                onClick={() => setAudience(a)}
                className={`px-2 py-0.5 rounded text-[10px] border ${
                  audience === a
                    ? 'border-fg bg-fg text-bg'
                    : 'border-border text-muted hover:bg-panel'
                }`}
              >
                {a}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-amber-600">
            ⚠ This rewrites the entire paper.
          </p>
          <div className="flex gap-2">
            <button
              disabled={busy || !audience.trim()}
              onClick={async () => {
                await onInvoke({
                  kind: 'reframe',
                  params: { audience: audience.trim() },
                });
                setOpen(false);
              }}
              className="px-3 py-1 rounded border border-fg bg-fg text-bg text-[10px] uppercase tracking-[0.14em] disabled:opacity-50"
            >
              {busy ? 'Running…' : 'Reframe'}
            </button>
            <button
              onClick={() => setOpen(false)}
              className="px-3 py-1 rounded border border-border text-[10px] uppercase tracking-[0.14em] hover:bg-panel"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          disabled={busy}
          onClick={() => setOpen(true)}
          className="px-3 py-1 rounded border border-border text-[10px] uppercase tracking-[0.14em] hover:bg-panel disabled:opacity-50"
        >
          {busy ? 'Running…' : 'Reframe…'}
        </button>
      )}
    </CardShell>
  );
}

function ResizeCard({
  wordCount,
  busyKind,
  onInvoke,
}: {
  wordCount: number;
  busyKind: string | null;
  onInvoke: OperationsPanelProps['onInvoke'];
}) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState(Math.max(1000, Math.round(wordCount * 0.7)));
  const busy = busyKind === 'resize';
  return (
    <CardShell
      title="Resize"
      desc={`Tighten or expand to a target word count. Current: ${wordCount.toLocaleString()} words.`}
    >
      {open ? (
        <div className="space-y-2">
          <input
            type="number"
            min={1000}
            max={25000}
            step={500}
            value={target}
            onChange={(e) => setTarget(Number(e.target.value))}
            className="w-full text-[12px] bg-bg border border-border rounded px-2 py-1 font-mono"
          />
          <div className="flex gap-2">
            <button
              disabled={busy || !target}
              onClick={async () => {
                await onInvoke({
                  kind: 'resize',
                  params: { target_words: target },
                });
                setOpen(false);
              }}
              className="px-3 py-1 rounded border border-fg bg-fg text-bg text-[10px] uppercase tracking-[0.14em] disabled:opacity-50"
            >
              {busy ? 'Running…' : 'Resize'}
            </button>
            <button
              onClick={() => setOpen(false)}
              className="px-3 py-1 rounded border border-border text-[10px] uppercase tracking-[0.14em] hover:bg-panel"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          disabled={busy}
          onClick={() => setOpen(true)}
          className="px-3 py-1 rounded border border-border text-[10px] uppercase tracking-[0.14em] hover:bg-panel disabled:opacity-50"
        >
          {busy ? 'Running…' : 'Resize…'}
        </button>
      )}
    </CardShell>
  );
}

// ---------- Sources ----------

function SourcesTab({
  sources,
  busyKind,
  onRunAudit,
}: {
  sources: ParsedSource[];
  busyKind: string | null;
  onRunAudit: () => Promise<unknown>;
}) {
  const [filter, setFilter] = useState<'all' | 'orphan' | 'unused'>('all');
  const filtered = sources.filter((s) => {
    if (filter === 'orphan') return s.usageCount === 0 && !s.title;
    if (filter === 'unused') return s.usageCount === 0;
    return true;
  });
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.14em] text-muted">
          {sources.length} source{sources.length === 1 ? '' : 's'}
        </span>
        <button
          disabled={busyKind === 'citation_audit'}
          onClick={() => onRunAudit()}
          className="px-2.5 py-0.5 rounded border border-border text-[10px] uppercase tracking-[0.14em] hover:bg-panel disabled:opacity-50"
        >
          {busyKind === 'citation_audit' ? 'Auditing…' : 'Run audit'}
        </button>
      </div>
      <div className="flex gap-1">
        {(['all', 'orphan', 'unused'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-2 py-0.5 rounded text-[10px] border ${
              filter === f
                ? 'border-fg bg-fg text-bg'
                : 'border-border text-muted hover:bg-panel'
            }`}
          >
            {f}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <p className="text-xs text-muted italic">No sources match.</p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((s) => (
            <li
              key={s.url}
              className="border border-border rounded bg-panel/40 p-2 space-y-1"
            >
              {s.title && (
                <p className="text-[12px] font-medium text-fg truncate">{s.title}</p>
              )}
              <a
                href={s.url}
                target="_blank"
                rel="noreferrer noopener"
                className="text-[11px] text-muted hover:text-fg break-all"
              >
                {s.url}
              </a>
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted">
                Used <span className="font-mono text-fg">{s.usageCount}</span>×
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------- Artifacts ----------

const ARTIFACT_META: Record<
  string,
  { label: string; desc: string; kind: ResearchOpKind }
> = {
  slide_deck: {
    label: 'Slide deck',
    desc: '8–12 slide outline of the paper.',
    kind: 'slide_deck',
  },
  email_tldr: {
    label: 'Email TLDR',
    desc: '200–300 word digest you can send.',
    kind: 'email_tldr',
  },
  qa_pack: {
    label: 'Q&A pack',
    desc: '10 grounded Q&A.',
    kind: 'qa_pack',
  },
  action_plan: {
    label: 'Action plan',
    desc: 'Now / Next / Later checklist.',
    kind: 'action_plan',
  },
  fact_check: {
    label: 'Fact-check report',
    desc: 'Per-claim ✓ / ⚠ / ✗ / contradicted.',
    kind: 'fact_check',
  },
  citation_audit: {
    label: 'Citation audit',
    desc: 'Orphans and unused sources.',
    kind: 'citation_audit',
  },
};

function ArtifactsTab({
  artifacts,
  busyKind,
  onInvoke,
  onRefresh,
}: {
  artifacts: ResearchArtifacts;
  busyKind: string | null;
  onInvoke: OperationsPanelProps['onInvoke'];
  onRefresh: () => Promise<unknown>;
}) {
  return (
    <div className="space-y-3">
      <button
        onClick={() => onRefresh()}
        className="text-[10px] uppercase tracking-[0.14em] text-muted hover:text-fg"
      >
        ↻ Refresh
      </button>
      {Object.entries(ARTIFACT_META).map(([key, meta]) => {
        const entry = artifacts[key];
        const busy = busyKind === meta.kind;
        return (
          <div
            key={key}
            className="border border-border rounded bg-panel/40 p-3 space-y-2"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-fg">{meta.label}</p>
                <p className="text-[11px] text-muted">{meta.desc}</p>
                {entry?.generated_at && (
                  <p className="text-[10px] text-muted mt-1">
                    Generated {formatTime(entry.generated_at)}
                  </p>
                )}
              </div>
              <button
                disabled={busy}
                onClick={() => onInvoke({ kind: meta.kind })}
                className="px-2.5 py-0.5 rounded border border-border text-[10px] uppercase tracking-[0.14em] hover:bg-panel disabled:opacity-50 whitespace-nowrap"
              >
                {busy ? 'Running…' : entry ? 'Regenerate' : 'Generate'}
              </button>
            </div>
            {entry?.text && (
              <ArtifactBody kind={key} text={entry.text} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ArtifactBody({ kind, text }: { kind: string; text: string }) {
  const [open, setOpen] = useState(false);
  const isFactCheck = kind === 'fact_check' || kind === 'citation_audit';
  return (
    <div className="border-t border-border pt-2 space-y-2">
      <div className="flex gap-2 items-center">
        <button
          onClick={() => setOpen((o) => !o)}
          className="text-[10px] uppercase tracking-[0.14em] text-muted hover:text-fg"
        >
          {open ? '− Hide' : '+ Show'}
        </button>
        <button
          onClick={() => {
            void navigator.clipboard.writeText(text);
          }}
          className="text-[10px] uppercase tracking-[0.14em] text-muted hover:text-fg"
        >
          Copy
        </button>
        {kind === 'email_tldr' && (
          <a
            href={`mailto:?body=${encodeURIComponent(text)}`}
            className="text-[10px] uppercase tracking-[0.14em] text-muted hover:text-fg"
          >
            Email
          </a>
        )}
      </div>
      {open && (
        <div
          className={`text-[12px] leading-[1.6] ${
            isFactCheck ? 'space-y-0.5' : 'prose-sm'
          }`}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}

// ---------- Chat ----------

function ChatTab({
  busyKind,
  onStart,
}: {
  busyKind: string | null;
  onStart: () => Promise<unknown>;
}) {
  const busy = busyKind === 'chat_with_paper';
  return (
    <div className="space-y-3">
      <p className="text-[12px] text-muted">
        Start a chat grounded only in this paper. The assistant cannot use other
        sources.
      </p>
      <button
        disabled={busy}
        onClick={() => onStart()}
        className="px-3 py-1 rounded border border-fg bg-fg text-bg text-[10px] uppercase tracking-[0.14em] disabled:opacity-50"
      >
        {busy ? 'Starting…' : 'Start chat about this paper'}
      </button>
    </div>
  );
}

// ---------- helpers ----------

function extractSectionTitles(content: string): string[] {
  const out: string[] = [];
  for (const m of content.matchAll(HEADING_RE)) {
    out.push(m[1].trim());
  }
  return out;
}

function extractSources(content: string): ParsedSource[] {
  const usage = new Map<string, number>();
  for (const m of content.matchAll(SOURCE_RE)) {
    const url = m[1];
    usage.set(url, (usage.get(url) ?? 0) + 1);
  }

  const titled = new Map<string, string>();
  const block = content.match(SOURCES_BLOCK_RE);
  if (block?.[1]) {
    const lines = block[1].split('\n');
    for (const line of lines) {
      const md = line.match(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/);
      if (md) {
        titled.set(md[2], md[1]);
        if (!usage.has(md[2])) usage.set(md[2], 0);
        continue;
      }
      const bare = line.match(/(https?:\/\/\S+)/);
      if (bare) {
        if (!usage.has(bare[1])) usage.set(bare[1], 0);
      }
    }
  }

  return Array.from(usage.entries()).map(([url, count]) => ({
    url,
    title: titled.get(url) ?? '',
    usageCount: count,
  }));
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}
