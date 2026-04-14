import { useMemo } from 'react';

interface Props {
  topic: string;
  content: string;
  onClose: () => void;
}

interface Segment {
  type: 'text' | 'source';
  value: string;
}

const SOURCE_RE = /\[Source:\s*(https?:\/\/[^\s\]]+)\s*\]/gi;

function tokenize(content: string): Segment[] {
  const segments: Segment[] = [];
  let lastIndex = 0;
  for (const match of content.matchAll(SOURCE_RE)) {
    const idx = match.index ?? 0;
    if (idx > lastIndex) {
      segments.push({ type: 'text', value: content.slice(lastIndex, idx) });
    }
    segments.push({ type: 'source', value: match[1] });
    lastIndex = idx + match[0].length;
  }
  if (lastIndex < content.length) {
    segments.push({ type: 'text', value: content.slice(lastIndex) });
  }
  return segments;
}

export function PaperViewer({ topic, content, onClose }: Props) {
  const segments = useMemo(() => tokenize(content), [content]);
  const sources = useMemo(() => {
    const set = new Set<string>();
    for (const s of segments) if (s.type === 'source') set.add(s.value);
    return Array.from(set);
  }, [segments]);

  return (
    <div className="fixed inset-0 z-40 flex items-stretch justify-center bg-fg/30 backdrop-blur-sm" onClick={onClose}>
      <div
        className="m-8 w-full max-w-4xl bg-bg border border-border rounded shadow-xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="shrink-0 border-b border-border px-6 py-4 flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted">Paper</p>
            <h2 className="font-display text-xl tracking-tight truncate">{topic}</h2>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded border border-border text-[10px] uppercase tracking-[0.14em] hover:bg-panel"
          >
            Close
          </button>
        </header>

        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-[1fr,260px]">
          <article className="px-6 py-6 prose-sm max-w-none text-sm leading-relaxed text-fg whitespace-pre-wrap">
            {segments.map((seg, i) =>
              seg.type === 'text' ? (
                <span key={i}>{seg.value}</span>
              ) : (
                <a
                  key={i}
                  href={seg.value}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center align-baseline ml-1 mr-0.5 px-1.5 py-px rounded bg-panel border border-border text-[10px] font-mono text-muted hover:text-fg hover:border-fg"
                  title={seg.value}
                >
                  src
                </a>
              )
            )}
          </article>

          <aside className="border-t lg:border-t-0 lg:border-l border-border px-4 py-6 bg-panel/40">
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted mb-3">Sources ({sources.length})</p>
            {sources.length === 0 ? (
              <p className="text-xs text-muted">No source citations</p>
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
          </aside>
        </div>
      </div>
    </div>
  );
}
