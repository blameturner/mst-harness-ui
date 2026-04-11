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
          {(() => {
            if (message.status === 'searching') return 'Searching the web';
            const label = typingLabelForIntent(message.intent);
            if (label) return label + '…';
            return <ThinkingLabel />;
          })()}{' '}
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
        {message.intent && (
          <div className="mb-2">
            <IntentChip intent={message.intent} />
          </div>
        )}
        <ConfidenceBanner confidence={message.searchConfidence} />
        <SearchStatusBadge status={message.searchStatus} />
        <MarkdownBody content={message.content} />
        {isStreaming && <span className="caret" />}
        <SourcesPanel
          sources={message.sources ?? []}
          layout={resolveSourceLayout(message.intent, !!message.sources?.length)}
        />
      </div>
    </div>
  );
}
