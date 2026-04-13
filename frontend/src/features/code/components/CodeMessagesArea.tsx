import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import type { CodeMessage } from '../types/CodeMessage';
import type { Mode } from '../types/Mode';
import { parseCodeBlocks } from '../utils/parseCodeBlocks';
import { styleLabel } from '../../../lib/styles/styleLabel';

interface CodeMessagesAreaProps {
  messages: CodeMessage[];
  mode: Mode;
  model: string;
  dragOver: boolean;
  copiedMessageId: string | null;
  scrollRef: React.RefObject<HTMLDivElement>;
  starterPrompts: string[];
  onSetInput: (text: string) => void;
  onApprovePlan: (m: CodeMessage) => void;
  onEdit: (m: CodeMessage) => void;
  onCopy: (m: CodeMessage) => Promise<void>;
  onRetry: (m: CodeMessage) => void;
  isAtBottom: boolean;
  onScrollToBottom: () => void;
  error: string | null;
}

export function CodeMessagesArea({
  messages,
  mode,
  model,
  dragOver,
  copiedMessageId,
  scrollRef,
  starterPrompts,
  onSetInput,
  onApprovePlan,
  onEdit,
  onCopy,
  onRetry,
  isAtBottom,
  onScrollToBottom,
  error,
}: CodeMessagesAreaProps) {
  return (
    <>
      <div
        ref={scrollRef}
        className={`flex-1 overflow-y-auto px-3 sm:px-6 py-4 sm:py-6 space-y-5 ${
          dragOver ? 'bg-panelHi/30 outline outline-2 outline-fg/40' : ''
        }`}
      >
        {messages.length === 0 ? (
          <div className="pt-12 md:pt-16 text-center px-2">
            <p className="font-display text-3xl font-semibold tracking-tightest">
              Code with Jeff.
            </p>
            <p className="text-muted text-sm mt-3 font-sans">
              Plan first · approve · Execute
            </p>
            {model && (
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {starterPrompts.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => onSetInput(p)}
                    className="text-[12px] sm:text-[13px] font-sans px-3 py-1.5 rounded-full border border-border text-muted bg-panel/40 hover:border-fg hover:text-fg transition-colors max-w-full text-left"
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
            <p className="text-muted text-[11px] mt-8 font-sans">
              Drop files anywhere to attach.
            </p>
          </div>
        ) : (
          messages.map((m) => {
            const blocks = m.role === 'assistant' ? parseCodeBlocks(m.content) : [];
            return (
              <div
                key={m.id}
                className={`group ${m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}`}
              >
                <div className="flex flex-col min-w-0 max-w-[94%] md:max-w-[85%] items-stretch">
                  <div
                    className={[
                      'px-4 py-3 rounded-2xl text-[14px] leading-relaxed',
                      m.role === 'user'
                        ? 'bg-fg text-bg rounded-br-sm whitespace-pre-wrap self-end'
                        : 'bg-panel border border-border text-fg rounded-bl-sm markdown-body',
                    ].join(' ')}
                  >
                    <div className="text-[9px] uppercase tracking-[0.16em] font-sans text-muted mb-1 flex items-center gap-2">
                      <span>{m.mode}</span>
                      {m.role === 'assistant' && m.responseStyle && (
                        <span className="inline-flex items-center gap-1 text-muted">
                          <span className="w-1 h-1 rounded-full bg-fg/50" />
                          {styleLabel(m.responseStyle)}
                        </span>
                      )}
                    </div>
                    {m.role === 'user' ? (
                      m.content
                    ) : m.status === 'error' ? (
                      <div className="text-red-600 font-sans text-[12px]">
                        <p className="break-words">
                          {m.errorMessage || 'Request failed'}
                        </p>
                        {m.sourceUserText && (
                          <button
                            type="button"
                            onClick={() => onRetry(m)}
                            className="mt-2 text-[10px] uppercase tracking-[0.14em] font-sans border border-red-600/60 text-red-600 px-2.5 py-1 rounded hover:bg-red-600 hover:text-bg transition-colors"
                          >
                            ↻ Retry
                          </button>
                        )}
                      </div>
                    ) : (
                      <>
                        {m.thinkingContent && (
                          <details
                            open={m.isThinking}
                            className="mb-2 group/think"
                          >
                            <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden flex items-center gap-1.5 text-[11px] font-sans text-muted select-none">
                              <svg
                                width="10"
                                height="10"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="transition-transform group-open/think:rotate-90"
                              >
                                <polyline points="9 6 15 12 9 18" />
                              </svg>
                              {m.isThinking ? (
                                <span className="animate-pulse">Thinking…</span>
                              ) : (
                                <span>
                                  Thought for{' '}
                                  {Math.round(
                                    ((m.thinkingEndTime ?? Date.now()) -
                                      (m.thinkingStartTime ?? Date.now())) /
                                      1000,
                                  )}
                                  s
                                </span>
                              )}
                            </summary>
                            <pre className="mt-1.5 text-[11px] font-mono text-muted bg-bg/60 rounded-md p-3 whitespace-pre-wrap max-h-60 overflow-y-auto border border-border">
                              {m.thinkingContent}
                            </pre>
                          </details>
                        )}
                        {m.status === 'streaming' && m.toolStatus && (
                          <div className="text-[11px] italic text-muted mb-2 font-sans">
                            {m.toolStatus}
                            {m.reconnecting && (
                              <span className="ml-2 not-italic uppercase tracking-[0.14em] text-muted/80">
                                · reconnecting
                              </span>
                            )}
                          </div>
                        )}
                        {m.status === 'streaming' && !m.content && !m.toolStatus && !m.isThinking && !m.thinkingContent && (
                          <div className="text-[11px] italic text-muted mb-2 font-sans">
                            {m.reconnecting ? 'Reconnecting…' : 'Thinking…'}
                          </div>
                        )}
                        <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{m.content}</ReactMarkdown>
                        <div className="flex flex-wrap gap-2 mt-3">
                          {m.mode === 'plan' && m.status === 'complete' && (
                            <button
                              onClick={() => onApprovePlan(m)}
                              className="text-[11px] uppercase tracking-[0.14em] font-sans border border-fg px-3 py-1 rounded hover:bg-fg hover:text-bg transition-colors"
                            >
                              Approve &amp; execute
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                  {m.role === 'user' && (
                    <button
                      type="button"
                      onClick={() => onEdit(m)}
                      className="self-end mt-1 text-[10px] uppercase tracking-[0.14em] font-sans text-muted hover:text-fg opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                    >
                      ✎ Edit
                    </button>
                  )}
                  {m.role === 'assistant' && m.status === 'complete' && m.content && (
                    <button
                      type="button"
                      onClick={() => void onCopy(m)}
                      className="self-start mt-1 text-[10px] uppercase tracking-[0.14em] font-sans text-muted hover:text-fg md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100 transition-opacity"
                    >
                      {copiedMessageId === m.id ? '✓ Copied' : '⧉ Copy'}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {!isAtBottom && messages.length > 0 && (
        <div className="px-3 sm:px-6 pb-2 pointer-events-none">
          <div className="flex justify-center">
            <button
              type="button"
              onClick={onScrollToBottom}
              className="pointer-events-auto text-[11px] uppercase tracking-[0.14em] font-sans px-3 py-1.5 rounded-full border border-border bg-panel/90 backdrop-blur text-fg hover:bg-panelHi transition-colors flex items-center gap-1.5 shadow-card"
              aria-label="Jump to latest"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
              Jump to latest
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="px-3 sm:px-6 pb-2">
          <p className="text-xs text-red-600 font-sans">{error}</p>
        </div>
      )}
    </>
  );
}

