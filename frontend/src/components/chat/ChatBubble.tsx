import { useState } from 'react';
import type { AgentOutput } from '../../api/types/AgentOutput';
import type { DisplayMessage } from './DisplayMessage';
import { ConfidenceBanner } from './ConfidenceBanner';
import { IntentChip } from './IntentChip';
import { SourcesPanel } from './SourcesPanel';
import { SearchStatusBadge } from './SearchStatusBadge';
import { ThinkingLabel } from './ThinkingLabel';
import { ElapsedTimer } from './ElapsedTimer';
import { OutputSection } from './OutputSection';
import { MarkdownBody } from './MarkdownBody';
import { resolveSourceLayout } from '../../lib/intent/resolveSourceLayout';
import { typingLabelForIntent } from '../../lib/intent/typingLabelForIntent';

interface Props {
  message: DisplayMessage;
  onRetry?: (message: DisplayMessage) => void;
  onEdit?: (message: DisplayMessage) => void;
}

const BUBBLE_MAX = 'max-w-[92%] md:max-w-[80%]';

function formatTimestamp(ms: number | undefined): string | undefined {
  if (ms == null) return undefined;
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return undefined;
  }
}

export function ChatBubble({ message, onRetry, onEdit }: Props) {
  const [copied, setCopied] = useState(false);

  async function copyContent() {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {}
  }

  if (message.role === 'user') {
    return (
      <div className="group flex justify-end animate-fadeIn" title={formatTimestamp(message.startedAt)}>
        <div className="flex flex-col items-end gap-1 min-w-0">
          <div className={`${BUBBLE_MAX} px-4 py-3 rounded-2xl rounded-br-sm text-[15px] leading-relaxed whitespace-pre-wrap bg-fg text-bg font-medium`}>
            {message.content}
          </div>
          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(message)}
              aria-label="Edit and resend"
              title="Edit and resend"
              className="text-[10px] uppercase tracking-[0.14em] font-sans text-muted hover:text-fg opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
            >
              ✎ Edit
            </button>
          )}
        </div>
      </div>
    );
  }

  if (message.role === 'system' || message.status === 'system') {
    if (message.content.startsWith('[Deep search result]')) {
      return <DeepSearchResultCard content={message.content} />;
    }
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
        <div className={`${BUBBLE_MAX} px-4 py-3 rounded-2xl rounded-bl-sm text-[15px] leading-relaxed bg-panel border border-border text-muted italic`}>
          {message.thinkingContent ? (
            <details open className="group/think not-italic">
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
                <span className="animate-pulse">Thinking…</span>
                <ElapsedTimer startedAt={message.thinkingStartTime} />
              </summary>
              <pre className="mt-1.5 text-[11px] font-mono text-muted bg-bg/60 rounded-md p-3 whitespace-pre-wrap max-h-60 overflow-y-auto border border-border">
                {message.thinkingContent}
              </pre>
            </details>
          ) : (
            <>
              {(() => {
                if (message.toolStatus) return message.toolStatus;
                if (message.status === 'searching') return 'Searching the web';
                const label = typingLabelForIntent(message.intent);
                if (label) return label + '…';
                return <ThinkingLabel />;
              })()}{' '}
              <ElapsedTimer startedAt={message.startedAt} />
              {message.reconnecting && (
                <span className="ml-2 text-[10px] uppercase tracking-[0.14em] not-italic text-muted/80">
                  · reconnecting
                </span>
              )}
            </>
          )}
          <span className="caret" />
        </div>
      </div>
    );
  }

  if (message.status === 'error') {
    return (
      <div className="flex justify-start animate-fadeIn">
        <div className={`${BUBBLE_MAX} px-4 py-3 rounded-2xl rounded-bl-sm text-[13px] leading-relaxed bg-panel border border-red-600/40 text-red-600 font-sans`}>
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
  const showCopy = message.status === 'complete' && !!message.content;

  if (message.parsedOutput && typeof message.parsedOutput === 'object') {
    const output = message.parsedOutput as unknown as AgentOutput;
    const confidenceColor: Record<string, string> = {
      high: 'bg-emerald-500/15 text-emerald-400 border-emerald-600/40',
      medium: 'bg-amber-500/15 text-amber-400 border-amber-600/40',
      low: 'bg-red-500/15 text-red-400 border-red-600/40',
    };

    return (
      <div className="group flex justify-start animate-fadeIn" title={formatTimestamp(message.startedAt)}>
        <div className={`${BUBBLE_MAX} bg-panel border border-border rounded-2xl rounded-bl-sm p-5 space-y-4`}>
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

          {showCopy && (
            <div className="pt-1">
              <CopyButton copied={copied} onCopy={copyContent} />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="group flex justify-start animate-fadeIn" title={formatTimestamp(message.startedAt)}>
      <div className={`${BUBBLE_MAX} px-5 py-4 rounded-2xl rounded-bl-sm bg-panel border border-border text-fg markdown-body`}>
        {message.intent && (
          <div className="mb-2">
            <IntentChip intent={message.intent} />
          </div>
        )}
        {message.thinkingContent && (
          <details open={message.isThinking} className="mb-2 group/think">
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
              {message.isThinking ? (
                <span className="animate-pulse">Thinking…</span>
              ) : (
                <span>
                  Thought for{' '}
                  {Math.round(
                    ((message.thinkingEndTime ?? Date.now()) -
                      (message.thinkingStartTime ?? Date.now())) /
                      1000,
                  )}
                  s
                </span>
              )}
            </summary>
            <pre className="mt-1.5 text-[11px] font-mono text-muted bg-bg/60 rounded-md p-3 whitespace-pre-wrap max-h-60 overflow-y-auto border border-border">
              {message.thinkingContent}
            </pre>
          </details>
        )}
        <ConfidenceBanner confidence={message.searchConfidence} />
        <SearchStatusBadge status={message.searchStatus} />
        <MarkdownBody content={message.content} />
        {isStreaming && <span className="caret" />}
        {message.deepSearchStatus === 'waiting' && (
          <div className="mt-2 flex items-center gap-1.5 text-[11px] font-sans text-muted bg-bg/60 border border-border rounded-md px-2.5 py-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            {message.deepSearchMessage || 'Researching in background...'}
          </div>
        )}
        {message.deepSearchStatus === 'done' && (
          <div className="mt-2 flex items-center gap-1.5 text-[11px] font-sans text-muted bg-bg/60 border border-border rounded-md px-2.5 py-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Deep research complete — results added below
          </div>
        )}
        <SourcesPanel
          sources={message.sources ?? []}
          layout={resolveSourceLayout(message.intent, !!message.sources?.length)}
        />
        {showCopy && (
          <div className="mt-2 -mb-1">
            <CopyButton copied={copied} onCopy={copyContent} />
          </div>
        )}
      </div>
    </div>
  );
}

function DeepSearchResultCard({ content }: { content: string }) {
  const [open, setOpen] = useState(false);
  const lines = content.replace('[Deep search result]\n', '').split('\n');
  let url = '';
  const summaryLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith('Source: ')) url = line.slice('Source: '.length).trim();
    else if (line.trim()) summaryLines.push(line);
  }
  const summary = summaryLines.join('\n');
  const hostname = url ? (() => { try { return new URL(url).hostname; } catch { return url; } })() : '';

  return (
    <div className="flex justify-start animate-fadeIn">
      <div className="max-w-[92%] md:max-w-[80%] rounded-md border border-border bg-panel/40 overflow-hidden">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-panelHi transition-colors"
        >
          <svg
            width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            className={`transition-transform shrink-0 text-muted ${open ? 'rotate-90' : ''}`}
          >
            <polyline points="9 6 15 12 9 18" />
          </svg>
          <span className="text-[11px] font-sans text-muted uppercase tracking-[0.12em]">
            Deep search result
          </span>
          {hostname && (
            <span className="text-[10px] font-sans text-muted truncate ml-auto">{hostname}</span>
          )}
        </button>
        {open && (
          <div className="px-3 pb-2.5 space-y-1.5">
            {url && (
              <a href={url} target="_blank" rel="noreferrer noopener"
                className="text-[11px] font-sans text-fg hover:underline underline-offset-2 break-all">
                {url}
              </a>
            )}
            {summary && (
              <p className="text-[11px] font-sans text-muted leading-relaxed whitespace-pre-wrap">
                {summary}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CopyButton({ copied, onCopy }: { copied: boolean; onCopy: () => void }) {
  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label={copied ? 'Copied' : 'Copy message'}
      title={copied ? 'Copied' : 'Copy message'}
      className="text-[10px] uppercase tracking-[0.14em] font-sans text-muted hover:text-fg inline-flex items-center gap-1 md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100 transition-opacity"
    >
      {copied ? '✓ Copied' : '⧉ Copy'}
    </button>
  );
}
