import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

// Memoised on content so elapsed-timer ticks don't re-parse the markdown AST
export const MarkdownBody = memo(function MarkdownBody({
  content,
}: {
  content: string;
}) {
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
            {children}
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
            {children}
          </li>
        ),
        blockquote: ({ children, ...rest }) => (
          <blockquote {...rest} className="border-l-2 border-fg pl-4 my-3 italic text-muted">
            {children}
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
            className="font-mono text-[12.5px] leading-relaxed bg-panelHi border border-border rounded-md p-3 my-3 overflow-x-auto whitespace-pre"
          />
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
});
