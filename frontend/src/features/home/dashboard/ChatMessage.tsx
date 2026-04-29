import type { ChatMessage as Msg } from '../hooks/useHomeChat';
import { MarkdownBody } from '../../../components/chat/MarkdownBody';

const WHY_RE = /\n+_why:\s*([\s\S]+?)_\s*$/i;
function splitWhy(text: string): { body: string; why: string | null } {
  const m = text.match(WHY_RE);
  if (!m) return { body: text, why: null };
  return { body: text.slice(0, m.index).trimEnd(), why: m[1].trim() };
}

export function ChatMessage({ m }: { m: Msg }) {
  const isUser = m.role === 'user';
  const isPA = !isUser && m.model === 'pa';
  const { body, why } = !isUser
    ? splitWhy(m.text)
    : { body: m.text, why: null };

  return (
    <div className={['flex', isUser ? 'justify-end' : 'justify-start'].join(' ')}>
      <div
        className={[
          'max-w-[92%] px-3 py-2 text-[13px] relative',
          isUser
            ? 'border border-fg text-fg'
            : isPA
              ? 'border border-border border-l-2 border-l-fg bg-panel/40 text-fg'
              : 'border border-border text-fg',
        ].join(' ')}
      >
        {isPA && (
          <div className="mb-1 text-[9px] uppercase tracking-[0.2em] font-sans text-muted">
            PA
          </div>
        )}
        {isUser ? (
          <div className="whitespace-pre-wrap">{m.text}</div>
        ) : (
          <>
            <MarkdownBody content={body || (m.streaming ? '…' : '')} />
            {why && (
              <p className="mt-2 pt-2 border-t border-border text-[11px] italic font-display text-muted">
                why · {why}
              </p>
            )}
          </>
        )}
        {m.streaming && <span className="ml-1 inline-block animate-pulse text-muted">|</span>}
      </div>
    </div>
  );
}
