import { useEffect, useState } from 'react';
import { highlightToTokens } from '../../lib/shiki/highlightToTokens';
import type { ShikiToken } from '../../lib/shiki/ShikiToken';

export function ShikiBlock({ code, lang }: { code: string; lang: string }) {
  const [lines, setLines] = useState<ShikiToken[][] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLines(null);
    highlightToTokens(code, lang)
      .then((res) => {
        if (!cancelled) setLines(res.tokens);
      })
      .catch(() => {
        if (!cancelled) setLines(null);
      });
    return () => {
      cancelled = true;
    };
  }, [code, lang]);

  if (!lines) {
    return (
      <pre className="font-mono text-[12px] leading-relaxed p-3 overflow-x-auto whitespace-pre bg-bg">
        <code>{code}</code>
      </pre>
    );
  }
  return (
    <pre className="font-mono text-[12px] leading-relaxed p-3 overflow-x-auto whitespace-pre bg-bg">
      <code>
        {lines.map((line, i) => (
          <span key={i} className="block">
            {line.length === 0 ? (
              '\n'
            ) : (
              <>
                {line.map((tok, j) => (
                  <span key={j} style={tok.color ? { color: tok.color } : undefined}>
                    {tok.content}
                  </span>
                ))}
                {i < lines.length - 1 ? '\n' : ''}
              </>
            )}
          </span>
        ))}
      </code>
    </pre>
  );
}
