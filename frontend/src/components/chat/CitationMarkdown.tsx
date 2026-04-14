import { memo } from 'react';
import type { ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

function renderWithCitations(text: string, anchorPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\[(\d+)\]/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) out.push(text.slice(last, match.index));
    const n = match[1];
    out.push(
      <a
        key={`cite-${key++}`}
        href={`#${anchorPrefix}-${n}`}
        onClick={(e) => {
          e.preventDefault();
          const el = document.getElementById(`${anchorPrefix}-${n}`);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }}
        className="inline-flex items-center justify-center text-[10px] font-sans font-semibold align-top -mt-0.5 mx-0.5 px-1.5 min-w-[18px] h-[18px] rounded-full bg-panelHi border border-border text-fg hover:bg-fg hover:text-bg transition-colors no-underline"
      >
        {n}
      </a>,
    );
    last = match.index + match[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function mapChildren(children: ReactNode, anchorPrefix: string): ReactNode {
  if (typeof children === 'string') {
    return <>{renderWithCitations(children, anchorPrefix)}</>;
  }
  if (Array.isArray(children)) {
    return children.map((c, i) =>
      typeof c === 'string' ? (
        <span key={`t-${i}`}>{renderWithCitations(c, anchorPrefix)}</span>
      ) : (
        c
      ),
    );
  }
  return children;
}

export const CitationMarkdown = memo(function CitationMarkdown({
  content,
  anchorPrefix,
}: {
  content: string;
  anchorPrefix: string;
}) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={{
        h1: (p) => <h1 {...p} className="font-display text-2xl font-semibold tracking-tightest mt-4 mb-2 first:mt-0" />,
        h2: (p) => <h2 {...p} className="font-display text-xl font-semibold tracking-tightest mt-4 mb-2 first:mt-0" />,
        h3: (p) => <h3 {...p} className="font-display text-lg font-semibold tracking-tightest mt-3 mb-1.5 first:mt-0" />,
        p: ({ children, ...rest }) => (
          <p {...rest} className="text-[15px] leading-relaxed my-2 first:mt-0 last:mb-0">
            {mapChildren(children, anchorPrefix)}
          </p>
        ),
        a: (p) => (
          <a
            {...p}
            target="_blank"
            rel="noreferrer noopener"
            className="text-fg underline underline-offset-4 decoration-border hover:decoration-fg transition-colors"
          />
        ),
        strong: (p) => <strong {...p} className="font-semibold text-fg" />,
        em: (p) => <em {...p} className="italic" />,
        ul: (p) => <ul {...p} className="list-disc pl-5 my-2 space-y-1 marker:text-muted" />,
        ol: (p) => <ol {...p} className="list-decimal pl-5 my-2 space-y-1 marker:text-muted" />,
        li: ({ children, ...rest }) => (
          <li {...rest} className="text-[15px] leading-relaxed">
            {mapChildren(children, anchorPrefix)}
          </li>
        ),
        blockquote: ({ children, ...rest }) => (
          <blockquote {...rest} className="border-l-2 border-fg pl-4 my-3 italic text-muted">
            {mapChildren(children, anchorPrefix)}
          </blockquote>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
});
