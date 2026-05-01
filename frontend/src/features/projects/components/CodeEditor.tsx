import { useEffect, useMemo, useRef } from 'react';

/** Tiny, dependency-free editor: textarea + synced line-number gutter.
 *  Tab inserts 2 spaces; Shift+Tab dedents.  Cmd/Ctrl+S calls onSave.
 *  Designed for the project workspace; not meant to replace Monaco.
 */
export function CodeEditor({
  value,
  onChange,
  onSave,
  readOnly = false,
  placeholder = '',
}: {
  value: string;
  onChange: (next: string) => void;
  onSave?: () => void;
  readOnly?: boolean;
  placeholder?: string;
}) {
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const gutterRef = useRef<HTMLDivElement | null>(null);

  const lineCount = useMemo(() => Math.max(1, value.split('\n').length), [value]);
  const lineNumbers = useMemo(
    () => Array.from({ length: lineCount }, (_, i) => String(i + 1)).join('\n'),
    [lineCount],
  );

  useEffect(() => {
    const ta = taRef.current;
    const g = gutterRef.current;
    if (!ta || !g) return;
    const sync = () => {
      g.scrollTop = ta.scrollTop;
    };
    ta.addEventListener('scroll', sync, { passive: true });
    return () => ta.removeEventListener('scroll', sync);
  }, []);

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const ta = e.currentTarget;

    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      onSave?.();
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      const indent = '  ';
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const before = value.slice(0, start);
      const sel = value.slice(start, end);
      const after = value.slice(end);

      if (e.shiftKey) {
        const lines = sel.split('\n');
        let removedFirst = 0;
        const dedented = lines
          .map((ln, i) => {
            const m = ln.match(/^( {1,2}|\t)/);
            if (!m) return ln;
            if (i === 0) removedFirst = m[0].length;
            return ln.slice(m[0].length);
          })
          .join('\n');
        onChange(before + dedented + after);
        requestAnimationFrame(() => {
          ta.selectionStart = Math.max(before.length, start - removedFirst);
          ta.selectionEnd = end - (sel.length - dedented.length);
        });
        return;
      }

      if (start !== end) {
        const lines = sel.split('\n');
        const indented = lines.map((ln) => indent + ln).join('\n');
        onChange(before + indented + after);
        requestAnimationFrame(() => {
          ta.selectionStart = start + indent.length;
          ta.selectionEnd = end + indent.length * lines.length;
        });
      } else {
        onChange(before + indent + after);
        requestAnimationFrame(() => {
          ta.selectionStart = ta.selectionEnd = start + indent.length;
        });
      }
      return;
    }

    if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const start = ta.selectionStart;
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      const leadMatch = value.slice(lineStart, start).match(/^[ \t]*/);
      const lead = leadMatch ? leadMatch[0] : '';
      if (lead.length > 0) {
        e.preventDefault();
        const before = value.slice(0, start);
        const after = value.slice(ta.selectionEnd);
        const insert = '\n' + lead;
        onChange(before + insert + after);
        requestAnimationFrame(() => {
          ta.selectionStart = ta.selectionEnd = start + insert.length;
        });
      }
    }
  }

  return (
    <div className="flex h-full overflow-hidden bg-bg">
      <div
        ref={gutterRef}
        className="select-none overflow-hidden whitespace-pre border-r border-border bg-panel/60 py-3 pl-3 pr-2 text-right font-mono text-[11px] leading-5 text-muted/60"
        style={{ minWidth: `${String(lineCount).length + 2}ch` }}
        aria-hidden
      >
        {lineNumbers}
      </div>
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        readOnly={readOnly}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        placeholder={placeholder}
        className="flex-1 resize-none bg-transparent p-3 font-mono text-[12px] leading-5 text-fg placeholder:text-muted outline-none"
      />
    </div>
  );
}
