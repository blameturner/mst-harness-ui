import { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ResearchPlan } from '../../../../api/types/Enrichment';
import { STATUS_TONES, parseGapReport } from './confidence';
import { ConfidenceMeter } from './ConfidenceMeter';
import { GapReportPanel } from './GapReportPanel';

interface Props {
  plan: ResearchPlan;
}

const SOURCE_RE = /\[Source:\s*(https?:\/\/[^\s\]]+)\s*\]/gi;

function extractSources(content: string): string[] {
  const set = new Set<string>();
  for (const match of content.matchAll(SOURCE_RE)) {
    set.add(match[1]);
  }
  return Array.from(set);
}

/**
 * Replace `[Source: https://…]` citations with standard markdown links
 * using the title attribute `"source"` as a styling flag that the
 * `components.a` override below picks up to render pills.
 */
function preprocessCitations(content: string): string {
  return content.replace(SOURCE_RE, (_m, url: string) => `[src](${url} "source")`);
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

export function ResearchPaperPage({ plan }: Props) {
  const [copied, setCopied] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    queries: true,
    subtopics: false,
    hypotheses: false,
    gap: false,
    schema: false,
  });

  const content = plan.paper_content ?? '';
  const processed = useMemo(() => preprocessCitations(content), [content]);
  const sources = useMemo(() => extractSources(content), [content]);
  const gap = useMemo(() => parseGapReport(plan.gap_report), [plan.gap_report]);
  const score =
    plan.confidence_score ?? gap?.confidence_score ?? 0;
  const threshold = plan.confidence_threshold ?? 80;
  const words = useMemo(() => countWords(content), [content]);
  const readMin = Math.max(1, Math.round(words / 220));

  function toggle(key: string) {
    setOpenSections((s) => ({ ...s, [key]: !s[key] }));
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  function handleExport() {
    const frontmatter =
      `---\n` +
      `topic: ${plan.topic}\n` +
      `iterations: ${plan.iterations ?? 0}/${plan.max_iterations ?? 3}\n` +
      `confidence: ${Math.round(score)}%\n` +
      `created: ${plan.created_at}\n` +
      `---\n\n`;
    const blob = new Blob([frontmatter + content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `research-${plan.Id}-${slugify(plan.topic || 'paper')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-7xl">
      {/* Header strip */}
      <header className="sticky top-0 z-10 bg-bg/95 backdrop-blur border-b border-border px-6 py-4 space-y-2">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="font-display text-2xl tracking-tightest text-fg truncate min-w-0">
            {plan.topic}
          </h1>
          <span
            className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-[0.1em] ${
              STATUS_TONES[plan.status] ?? 'bg-muted/30 text-muted'
            }`}
          >
            {plan.status}
          </span>
        </div>
        <div className="flex items-center gap-x-4 gap-y-1.5 flex-wrap text-[11px] text-muted">
          <span>
            Iterations{' '}
            <span className="font-mono text-fg">
              {plan.iterations ?? 0} / {plan.max_iterations ?? 3}
            </span>
          </span>
          <span>·</span>
          <span>
            Queries <span className="font-mono text-fg">{plan.queries?.length ?? 0}</span>
          </span>
          <span>·</span>
          <span>
            Confidence <span className="font-mono text-fg">{Math.round(score)}%</span>
          </span>
          <span>·</span>
          <span>
            Words <span className="font-mono text-fg">{words.toLocaleString()}</span>
          </span>
          <span>·</span>
          <span>
            Read <span className="font-mono text-fg">{readMin} min</span>
          </span>
          <span className="ml-auto flex items-center gap-2">
            <button
              onClick={handleCopy}
              disabled={!content}
              className="px-3 py-1 rounded border border-border text-[10px] uppercase tracking-[0.14em] hover:bg-panel disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button
              onClick={handleExport}
              disabled={!content}
              className="px-3 py-1 rounded border border-border text-[10px] uppercase tracking-[0.14em] hover:bg-panel disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Export .md
            </button>
          </span>
        </div>
      </header>

      {/* Body */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr,280px] gap-6 px-6 py-6">
        {/* Article column */}
        <article className="mx-auto w-full max-w-[72ch] px-0 py-2 text-fg text-[15px] leading-[1.7]">
          {content ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: (props) => (
                  <h1
                    {...props}
                    className="font-display text-3xl tracking-tightest mt-6 mb-3 first:mt-0"
                  />
                ),
                h2: (props) => (
                  <h2
                    {...props}
                    className="font-display text-2xl tracking-tightest mt-6 mb-2 first:mt-0"
                  />
                ),
                h3: (props) => (
                  <h3
                    {...props}
                    className="font-display text-xl tracking-tightest mt-5 mb-2 first:mt-0"
                  />
                ),
                h4: (props) => (
                  <h4
                    {...props}
                    className="font-sans text-[12px] uppercase tracking-[0.14em] text-muted mt-4 mb-1.5 first:mt-0"
                  />
                ),
                p: ({ children, ...rest }) => (
                  <p {...rest} className="my-3 first:mt-0 last:mb-0">
                    {children}
                  </p>
                ),
                a: ({ title, href, children, ...rest }) => {
                  const isCitation = title === 'source';
                  if (isCitation) {
                    return (
                      <a
                        {...rest}
                        href={href}
                        target="_blank"
                        rel="noreferrer noopener"
                        title={href}
                        className="inline-flex items-center align-baseline ml-1 mr-0.5 px-1.5 py-px rounded bg-panel border border-border text-[10px] font-mono text-muted hover:text-fg hover:border-fg no-underline"
                      >
                        src
                      </a>
                    );
                  }
                  return (
                    <a
                      {...rest}
                      href={href}
                      title={title}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-fg underline underline-offset-4 decoration-border hover:decoration-fg transition-colors"
                    >
                      {children}
                    </a>
                  );
                },
                strong: (props) => <strong {...props} className="font-semibold text-fg" />,
                em: (props) => <em {...props} className="italic" />,
                ul: (props) => (
                  <ul {...props} className="list-disc pl-6 my-3 space-y-1.5 marker:text-muted" />
                ),
                ol: (props) => (
                  <ol {...props} className="list-decimal pl-6 my-3 space-y-1.5 marker:text-muted" />
                ),
                li: ({ children, ...rest }) => (
                  <li {...rest} className="leading-[1.7]">
                    {children}
                  </li>
                ),
                blockquote: ({ children, ...rest }) => (
                  <blockquote
                    {...rest}
                    className="border-l-2 border-fg pl-4 my-4 italic text-muted"
                  >
                    {children}
                  </blockquote>
                ),
                hr: (props) => <hr {...props} className="border-border my-6" />,
                table: (props) => (
                  <div className="my-4 overflow-x-auto">
                    <table {...props} className="w-full text-[13px] border-collapse" />
                  </div>
                ),
                thead: (props) => <thead {...props} className="border-b-2 border-fg" />,
                th: (props) => (
                  <th
                    {...props}
                    className="text-left font-semibold font-sans text-[11px] uppercase tracking-[0.12em] px-3 py-1.5 text-fg"
                  />
                ),
                td: ({ children, ...rest }) => (
                  <td {...rest} className="px-3 py-1.5 border-b border-border align-top">
                    {children}
                  </td>
                ),
                code: ({ className, children, ...rest }) => {
                  const isBlock = /language-/.test(className ?? '');
                  if (isBlock) {
                    return (
                      <code {...rest} className={`${className ?? ''} block`}>
                        {children}
                      </code>
                    );
                  }
                  return (
                    <code
                      {...rest}
                      className="font-mono text-[13px] bg-panelHi border border-border rounded px-1 py-0.5"
                    >
                      {children}
                    </code>
                  );
                },
                pre: (props) => (
                  <pre
                    {...props}
                    className="font-mono text-[12.5px] leading-relaxed bg-panelHi border border-border rounded-md p-3 my-4 overflow-x-auto whitespace-pre"
                  />
                ),
              }}
            >
              {processed}
            </ReactMarkdown>
          ) : (
            <p className="text-muted text-sm italic">No paper content yet.</p>
          )}
        </article>

        {/* Sidebar */}
        <aside className="space-y-4 lg:border-l lg:border-border lg:pl-6">
          <div className="space-y-3">
            <ConfidenceMeter score={score} threshold={threshold} />
          </div>

          <DrawerSection
            label="Queries"
            count={plan.queries?.length ?? 0}
            open={openSections.queries}
            onToggle={() => toggle('queries')}
          >
            {plan.queries?.length > 0 ? (
              <ul className="text-xs text-fg space-y-1 font-mono">
                {plan.queries.map((q, i) => (
                  <li key={i}>• {q}</li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted italic">No queries</p>
            )}
          </DrawerSection>

          <DrawerSection
            label="Sub-topics"
            count={plan.sub_topics?.length ?? 0}
            open={openSections.subtopics}
            onToggle={() => toggle('subtopics')}
          >
            {plan.sub_topics?.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {plan.sub_topics.map((t, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 rounded bg-panel border border-border text-[11px]"
                  >
                    {t}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted italic">No sub-topics</p>
            )}
          </DrawerSection>

          <DrawerSection
            label="Hypotheses"
            count={plan.hypotheses?.length ?? 0}
            open={openSections.hypotheses}
            onToggle={() => toggle('hypotheses')}
          >
            {plan.hypotheses?.length > 0 ? (
              <ul className="text-xs text-fg space-y-1">
                {plan.hypotheses.map((h, i) => (
                  <li key={i}>• {h}</li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted italic">No hypotheses</p>
            )}
          </DrawerSection>

          <DrawerSection
            label="Gap report"
            open={openSections.gap}
            onToggle={() => toggle('gap')}
          >
            {gap ? (
              <GapReportPanel report={gap} threshold={threshold} />
            ) : (
              <p className="text-xs text-muted italic">No gap report</p>
            )}
          </DrawerSection>

          <DrawerSection
            label="Schema"
            count={plan.schema ? Object.keys(plan.schema).length : 0}
            open={openSections.schema}
            onToggle={() => toggle('schema')}
          >
            {plan.schema && Object.keys(plan.schema).length > 0 ? (
              <pre className="text-[11px] font-mono text-fg bg-panel p-2 rounded border border-border overflow-x-auto">
                {JSON.stringify(plan.schema, null, 2)}
              </pre>
            ) : (
              <p className="text-xs text-muted italic">No schema</p>
            )}
          </DrawerSection>

          {/* Sources */}
          <div className="pt-2 border-t border-border">
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted mb-3">
              Sources ({sources.length})
            </p>
            {sources.length === 0 ? (
              <p className="text-xs text-muted italic">No source citations</p>
            ) : (
              <ul className="space-y-2">
                {sources.map((url, i) => (
                  <li key={url} className="text-xs">
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-fg hover:underline break-all"
                    >
                      <span className="text-muted mr-1">[{i + 1}]</span>
                      {url}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function DrawerSection({
  label,
  count,
  open,
  onToggle,
  children,
}: {
  label: string;
  count?: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-border rounded bg-panel/40">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-panel/60"
      >
        <span className="text-[10px] uppercase tracking-[0.14em] text-muted">
          {label}
          {count != null && (
            <span className="ml-1.5 font-mono text-fg">({count})</span>
          )}
        </span>
        <span className="text-[10px] font-mono text-muted">{open ? '−' : '+'}</span>
      </button>
      {open && <div className="px-3 pb-3 pt-1">{children}</div>}
    </div>
  );
}
