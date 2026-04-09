import { memo, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export type MessageStatus = 'complete' | 'pending' | 'streaming' | 'error' | 'system' | 'searching';

export interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  status: MessageStatus;
  /** Wall-clock start used by the pending elapsed counter. */
  startedAt?: number;
  tokensIn?: number;
  tokensOut?: number;
  contextChars?: number;
  errorMessage?: string;
  /** Web search citations — 'Title: URL' strings. */
  sources?: string[];
  /** True if a web search was attempted but returned no usable results. */
  searchFailed?: boolean;
  /** Response-style key used for this turn (e.g. "general", "senior_review").
   *  Rendered as a tiny badge next to the tokens footer so the user can see
   *  which preset produced each reply when styles change mid-conversation. */
  responseStyle?: string | null;
}

interface Props {
  message: DisplayMessage;
}

/**
 * Assistant messages render as Markdown (GFM). User messages are pre-wrap
 * plain text — we never reinterpret operator input. Additional lifecycle
 * states: pending (with elapsed timer), streaming (markdown + cursor),
 * error, and synthetic system notices (e.g. summarisation).
 */
export function ChatBubble({ message }: Props) {
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
        <div className="text-[10px] uppercase tracking-[0.16em] font-mono text-muted px-3 py-1 rounded-full border border-border bg-panel/40">
          {message.content}
        </div>
      </div>
    );
  }

  if (message.status === 'pending' || message.status === 'searching') {
    const label = message.status === 'searching' ? 'Searching the web' : 'Thinking';
    return (
      <div className="flex justify-start animate-fadeIn">
        <div className="max-w-[92%] md:max-w-[78%] px-4 py-3 rounded-2xl rounded-bl-sm text-[15px] leading-relaxed bg-panel border border-border text-muted italic">
          {label} <ElapsedTimer startedAt={message.startedAt} />
          <span className="caret" />
        </div>
      </div>
    );
  }

  if (message.status === 'error') {
    return (
      <div className="flex justify-start animate-fadeIn">
        <div className="max-w-[92%] md:max-w-[78%] px-4 py-3 rounded-2xl rounded-bl-sm text-[13px] leading-relaxed bg-panel border border-red-600/40 text-red-600 font-mono">
          {message.errorMessage || message.content || 'Request failed'}
        </div>
      </div>
    );
  }

  const isStreaming = message.status === 'streaming';

  return (
    <div className="flex justify-start animate-fadeIn">
      <div className="max-w-[94%] md:max-w-[85%] px-5 py-4 rounded-2xl rounded-bl-sm bg-panel border border-border text-fg markdown-body">
        {message.searchFailed && (
          <div className="mb-3 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] font-mono text-muted px-2 py-0.5 rounded-full border border-border bg-bg">
            <span aria-hidden>·</span> Search returned no results
          </div>
        )}
        <MarkdownBody content={message.content} />
        {isStreaming && <span className="caret" />}
        {message.sources && message.sources.length > 0 && (
          <div className="mt-4 pt-3 border-t border-border">
            <p className="text-[10px] uppercase tracking-[0.16em] font-mono text-muted mb-1.5">
              Sources
            </p>
            <ul className="space-y-1">
              {message.sources.map((src, i) => {
                const match = src.match(/^(.*?):\s*(https?:\/\/\S+)$/);
                const title = match ? match[1] : src;
                const url = match ? match[2] : '';
                return (
                  <li key={i} className="text-[12px] leading-snug">
                    <span className="font-mono text-muted mr-1">[{i + 1}]</span>
                    {url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-fg underline underline-offset-2 decoration-border hover:decoration-fg"
                      >
                        {title}
                      </a>
                    ) : (
                      <span>{title}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

/** Live elapsed counter in seconds. Ticks every 500ms while mounted. */
function ElapsedTimer({ startedAt }: { startedAt?: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startedAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [startedAt]);
  if (!startedAt) return null;
  const s = Math.max(0, Math.floor((now - startedAt) / 1000));
  return <span className="not-italic font-mono text-[11px]">· {s}s</span>;
}

/**
 * Memoised on `content` so unrelated re-renders (elapsed timers, sibling
 * message updates) don't re-parse the markdown AST on every tick.
 */
const MarkdownBody = memo(function MarkdownBody({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
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
        p: (props) => (
          <p {...props} className="text-[15px] leading-relaxed my-2 first:mt-0 last:mb-0" />
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
        li: (props) => <li {...props} className="text-[15px] leading-relaxed" />,
        blockquote: (props) => (
          <blockquote {...props} className="border-l-2 border-fg pl-4 my-3 italic text-muted" />
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
            className="text-left font-semibold font-mono text-[11px] uppercase tracking-[0.12em] px-3 py-1.5 text-fg"
          />
        ),
        td: (props) => (
          <td {...props} className="px-3 py-1.5 border-b border-border align-top" />
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
