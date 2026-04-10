import { memo, useEffect, useState, useCallback, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import type { SearchSource, SearchConfidence, AgentOutput } from '../lib/api';

/** Return the 1-based citation number.
 *  SSE sources have `index` (already 1-based).
 *  Persisted sources have `source_index` (0-based in DB). */
function citationIndex(src: SearchSource): number {
  if (src.index != null) return src.index;
  if (src.source_index != null) return src.source_index + 1;
  return 0;
}

export type MessageStatus = 'complete' | 'pending' | 'streaming' | 'error' | 'system' | 'searching';

export interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  status: MessageStatus;
  startedAt?: number;
  tokensIn?: number;
  tokensOut?: number;
  contextChars?: number;
  errorMessage?: string;
  sources?: SearchSource[];
  searchConfidence?: SearchConfidence;
  searchFailed?: boolean;
  responseStyle?: string | null;
  sourceUserText?: string;
  parsedOutput?: unknown;
}

interface Props {
  message: DisplayMessage;
  onRetry?: (message: DisplayMessage) => void;
}

export function ChatBubble({ message, onRetry }: Props) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end animate-fadeIn">
        <div className="max-w-[92%] md:max-w-[78%] px-4 py-3 rounded-2xl rounded-br-sm text-[15px] leading-relaxed whitespace-pre-wrap bg-fg text-bg font-medium">
          {message.content}
        </div>
      </div>
    );
  }

  if (message.role === 'system' || message.status === 'system') {
    return (
      <div className="flex justify-center animate-fadeIn">
        <div className="text-[10px] uppercase tracking-[0.16em] font-sans text-muted px-3 py-1 rounded-full border border-border bg-panel/40">
          {message.content}
        </div>
      </div>
    );
  }

  if (message.status === 'pending' || message.status === 'searching') {
    return (
      <div className="flex justify-start animate-fadeIn">
        <div className="max-w-[92%] md:max-w-[78%] px-4 py-3 rounded-2xl rounded-bl-sm text-[15px] leading-relaxed bg-panel border border-border text-muted italic">
          {message.status === 'searching' ? 'Searching the web' : <ThinkingLabel />}{' '}
          <ElapsedTimer startedAt={message.startedAt} />
          <span className="caret" />
        </div>
      </div>
    );
  }

  if (message.status === 'error') {
    return (
      <div className="flex justify-start animate-fadeIn">
        <div className="max-w-[92%] md:max-w-[78%] px-4 py-3 rounded-2xl rounded-bl-sm text-[13px] leading-relaxed bg-panel border border-red-600/40 text-red-600 font-sans">
          <p className="break-words">
            {message.errorMessage || message.content || 'Request failed'}
          </p>
          {onRetry && message.sourceUserText && (
            <button
              type="button"
              onClick={() => onRetry(message)}
              className="mt-2 text-[10px] uppercase tracking-[0.14em] font-sans border border-red-600/60 text-red-600 px-2.5 py-1 rounded hover:bg-red-600 hover:text-bg transition-colors"
            >
              ↻ Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  const isStreaming = message.status === 'streaming';

  // If we have structured parsed output, render it with rich formatting
  if (message.parsedOutput && typeof message.parsedOutput === 'object') {
    const output = message.parsedOutput as unknown as AgentOutput;
    const confidenceColor: Record<string, string> = {
      high: 'bg-emerald-500/15 text-emerald-400 border-emerald-600/40',
      medium: 'bg-amber-500/15 text-amber-400 border-amber-600/40',
      low: 'bg-red-500/15 text-red-400 border-red-600/40',
    };

    return (
      <div className="flex justify-start animate-fadeIn">
        <div className="max-w-[94%] md:max-w-[85%] bg-panel border border-border rounded-2xl rounded-bl-sm p-5 space-y-4">
          <header className="flex items-start justify-between gap-4">
            <h2 className="font-display text-xl font-semibold leading-tight">{output.title}</h2>
            <span
              className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border ${
                confidenceColor[output.confidence] ?? confidenceColor.medium
              }`}
            >
              {output.confidence}
            </span>
          </header>

          {output.summary && <p className="text-fg leading-relaxed">{output.summary}</p>}

          <OutputSection title="Key points" items={output.key_points} />
          <OutputSection title="Recommendations" items={output.recommendations} tone="accent" />
          <OutputSection title="Next steps" items={output.next_steps} />
          <OutputSection title="Observations" items={output.observations} muted />

          {output.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {output.tags.map((t) => (
                <span
                  key={t}
                  className="text-[11px] px-2 py-0.5 rounded-full bg-panelHi border border-border text-muted"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start animate-fadeIn">
      <div className="max-w-[94%] md:max-w-[85%] px-5 py-4 rounded-2xl rounded-bl-sm bg-panel border border-border text-fg markdown-body">
        <ConfidenceBanner confidence={message.searchConfidence} />
        {message.searchFailed && (
          <div className="mb-3 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] font-sans text-muted px-2 py-0.5 rounded-full border border-border bg-bg">
            <span aria-hidden>·</span> Search returned no results
          </div>
        )}
        <MarkdownBody content={message.content} sources={message.sources} />
        {isStreaming && <span className="caret" />}
        {message.sources && message.sources.length > 0 && (
          <div className="mt-4 pt-3 border-t border-border">
            <p className="text-[10px] uppercase tracking-[0.16em] font-sans text-muted mb-2">
              Sources
            </p>
            <div className="space-y-2">
              {sortedByRelevance(message.sources).map((src) => (
                <SourceCard key={citationIndex(src)} source={src} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* —— Confidence banner —— */

function ConfidenceBanner({ confidence }: { confidence?: SearchConfidence }) {
  if (!confidence || confidence === 'high') return null;

  const labels: Record<Exclude<SearchConfidence, 'high'>, string> = {
    medium: 'Some related sources found — results may not fully cover this topic',
    low: 'Limited relevant sources — answer may rely on general knowledge',
    none: 'No search results found',
  };

  const styles: Record<Exclude<SearchConfidence, 'high'>, string> = {
    medium: 'border-amber-500/40 text-amber-600',
    low: 'border-amber-600/50 text-amber-600',
    none: 'border-border text-muted',
  };

  return (
    <div
      className={`mb-3 text-[11px] font-sans px-3 py-1.5 rounded-md border ${styles[confidence]}`}
    >
      {labels[confidence]}
    </div>
  );
}

/* —— Source reference card —— */

const RELEVANCE_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2, unknown: 3 };

function sortedByRelevance(sources: SearchSource[]): SearchSource[] {
  return [...sources].sort(
    (a, b) => (RELEVANCE_ORDER[a.relevance] ?? 3) - (RELEVANCE_ORDER[b.relevance] ?? 3),
  );
}

const RELEVANCE_COLORS: Record<string, string> = {
  high: 'bg-green-600/15 text-green-700 border-green-600/30',
  medium: 'bg-amber-500/15 text-amber-700 border-amber-500/30',
  low: 'bg-border/60 text-muted border-border',
  unknown: 'bg-border/60 text-muted border-border',
};

function SourceCard({ source }: { source: SearchSource }) {
  const relClass = RELEVANCE_COLORS[source.relevance] ?? RELEVANCE_COLORS.unknown;
  const typeLabel = source.source_type.replace(/_/g, ' ');
  const idx = citationIndex(source);

  return (
    <a
      id={`source-${idx}`}
      href={source.url}
      target="_blank"
      rel="noreferrer noopener"
      className="block rounded-lg border border-border bg-bg/60 px-3 py-2 hover:border-fg/40 transition-colors group"
    >
      <div className="flex items-start gap-2">
        <span className="shrink-0 w-5 h-5 rounded-full border border-border bg-panel flex items-center justify-center text-[10px] font-sans text-muted">
          {idx}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium leading-snug truncate group-hover:underline underline-offset-2 decoration-border">
            {source.title}
          </p>
          {source.snippet && (
            <p className="text-[11px] text-muted leading-relaxed mt-0.5 line-clamp-2">
              {source.snippet}
            </p>
          )}
          <div className="flex items-center gap-1.5 mt-1.5">
            <span
              className={`text-[9px] uppercase tracking-[0.12em] font-sans px-1.5 py-0.5 rounded border ${relClass}`}
            >
              {source.relevance}
            </span>
            <span className="text-[9px] uppercase tracking-[0.12em] font-sans px-1.5 py-0.5 rounded border border-border text-muted">
              {typeLabel}
            </span>
          </div>
        </div>
      </div>
    </a>
  );
}

/* —— Thinking labels —— */

const THINKING_LABELS = [
  'Knocking things off the desk',
  'Chasing a laser pointer',
  'Napping on the keyboard',
  'Ignoring your request',
  'Sharpening claws on the server',
  'Sitting on important documents',
  'Staring at a wall',
  'Plotting world domination',
  'Coughing up a hairball',
  'Judging you silently',
  'Demanding treats',
  'Pushing things off the edge',
  'Zooming around at 3am',
  'Pretending not to hear you',
  'Kneading the data',
  'Fitting into a box too small',
  'Knocking over your coffee',
  'Hunting a bug in production',
  'Taking a strategic nap',
  'Refusing to come when called',
];

function ThinkingLabel() {
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * THINKING_LABELS.length));
  useEffect(() => {
    const id = window.setInterval(() => {
      setIdx((prev) => {
        let next: number;
        do { next = Math.floor(Math.random() * THINKING_LABELS.length); } while (next === prev && THINKING_LABELS.length > 1);
        return next;
      });
    }, 4000);
    return () => window.clearInterval(id);
  }, []);
  return <>{THINKING_LABELS[idx]}</>;
}

function ElapsedTimer({ startedAt }: { startedAt?: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startedAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [startedAt]);
  if (!startedAt) return null;
  const s = Math.max(0, Math.floor((now - startedAt) / 1000));
  return <span className="not-italic font-sans text-[11px]">· {s}s</span>;
}

/* —— Structured output section —— */

function OutputSection({
  title,
  items,
  tone,
  muted,
}: {
  title: string;
  items?: string[];
  tone?: 'accent';
  muted?: boolean;
}) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted mb-1.5">{title}</p>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li
            key={i}
            className={`flex gap-2 text-sm leading-relaxed ${
              muted ? 'text-muted' : tone === 'accent' ? 'text-accent' : 'text-fg'
            }`}
          >
            <span className="text-muted select-none">›</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* —— Inline citation parsing —— */

const CITATION_RE = /\[(\d+)\]/g;

/** Split text into literal segments and citation references. */
function parseCitations(
  text: string,
  sources?: SearchSource[],
): ReactNode[] {
  if (!sources || sources.length === 0) return [text];

  const parts: ReactNode[] = [];
  let lastIndex = 0;

  // Reset regex state for each call
  CITATION_RE.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = CITATION_RE.exec(text)) !== null) {
    const idx = parseInt(match[1], 10);
    const src = sources.find((s) => citationIndex(s) === idx);
    if (!src) continue;

    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <a
        key={`cite-${match.index}`}
        href={`#source-${idx}`}
        title={`${src.title} — ${src.url}`}
        onClick={(e) => {
          e.preventDefault();
          document.getElementById(`source-${idx}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }}
        className="inline-flex items-center justify-center text-[10px] font-sans font-medium bg-panelHi border border-border rounded px-1 py-px ml-0.5 -translate-y-0.5 hover:border-fg hover:text-fg transition-colors cursor-pointer no-underline"
      >
        {idx}
      </a>,
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

// Memoised on content + sources so elapsed-timer ticks don't re-parse the markdown AST
const MarkdownBody = memo(function MarkdownBody({
  content,
  sources,
}: {
  content: string;
  sources?: SearchSource[];
}) {
  const renderCitations = useCallback(
    (text: string) => parseCitations(text, sources),
    [sources],
  );

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={{
        h1: (props) => (
          <h1
            {...props}
            className="font-display text-2xl font-semibold tracking-tightest mt-4 mb-2 first:mt-0"
          />
        ),
        h2: (props) => (
          <h2
            {...props}
            className="font-display text-xl font-semibold tracking-tightest mt-4 mb-2 first:mt-0"
          />
        ),
        h3: (props) => (
          <h3
            {...props}
            className="font-display text-lg font-semibold tracking-tightest mt-3 mb-1.5 first:mt-0"
          />
        ),
        h4: (props) => (
          <h4
            {...props}
            className="font-sans text-[13px] uppercase tracking-[0.14em] text-muted mt-3 mb-1 first:mt-0"
          />
        ),
        p: ({ children, ...rest }) => (
          <p {...rest} className="text-[15px] leading-relaxed my-2 first:mt-0 last:mb-0">
            {typeof children === 'string' ? renderCitations(children) : children}
          </p>
        ),
        a: (props) => (
          <a
            {...props}
            target="_blank"
            rel="noreferrer noopener"
            className="text-fg underline underline-offset-4 decoration-border hover:decoration-fg transition-colors"
          />
        ),
        strong: (props) => <strong {...props} className="font-semibold text-fg" />,
        em: (props) => <em {...props} className="italic" />,
        del: (props) => <del {...props} className="text-muted" />,
        ul: (props) => (
          <ul {...props} className="list-disc pl-5 my-2 space-y-1 marker:text-muted" />
        ),
        ol: (props) => (
          <ol {...props} className="list-decimal pl-5 my-2 space-y-1 marker:text-muted" />
        ),
        li: ({ children, ...rest }) => (
          <li {...rest} className="text-[15px] leading-relaxed">
            {typeof children === 'string' ? renderCitations(children) : children}
          </li>
        ),
        blockquote: ({ children, ...rest }) => (
          <blockquote {...rest} className="border-l-2 border-fg pl-4 my-3 italic text-muted">
            {typeof children === 'string' ? renderCitations(children) : children}
          </blockquote>
        ),
        hr: (props) => <hr {...props} className="border-border my-4" />,
        table: (props) => (
          <div className="my-3 overflow-x-auto">
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
            {typeof children === 'string' ? renderCitations(children) : children}
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
            className="font-mono text-[12.5px] leading-relaxed bg-panelHi border border-border rounded-md p-3 my-3 overflow-x-auto whitespace-pre"
          />
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
});
