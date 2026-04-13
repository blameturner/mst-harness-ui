import type { Conversation } from '../../api/types/Conversation';
import { ConversationList } from '../../components/ConversationList';
import { useQueueStatus } from '../../hooks/useQueueStatus';
import type { BackoffState } from '../../api/types/QueueStatus';

const BACKOFF_LABELS: Record<BackoffState, string> = {
  active: 'Waiting for clear air',
  priority_1_only: 'Research only',
  priority_1_2_only: 'Research + deep search',
  clear: 'Idle',
};

function sumCounts(counts: Record<string, { queued: number; running: number }>): {
  queued: number;
  running: number;
} {
  let queued = 0;
  let running = 0;
  for (const v of Object.values(counts)) {
    queued += v.queued;
    running += v.running;
  }
  return { queued, running };
}

export function SidebarBody({
  onNewChat,
  conversations,
  activeId,
  onSelect,
  loading,
}: {
  onNewChat: () => void;
  conversations: Conversation[];
  activeId: number | null;
  onSelect: (c: Conversation) => void;
  loading: boolean;
}) {
  const queueStatus = useQueueStatus();

  const totals = queueStatus ? sumCounts(queueStatus.counts) : null;
  const active = totals ? totals.queued + totals.running : 0;
  const backoffLabel = queueStatus ? BACKOFF_LABELS[queueStatus.backoff.state] : null;

  return (
    <>
      <div className="px-6 pt-6 pb-4 border-b border-border">
        <h1 className="font-display text-3xl font-semibold tracking-tightest leading-none">
          Jeff<span className="italic">GPT</span>
          <span className="inline-block w-2 h-2 bg-fg rounded-full align-middle ml-2" />
        </h1>
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted mt-2">
          local intelligence
        </p>
      </div>

      <div className="px-4 pt-4 pb-2">
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-md border border-fg bg-bg text-fg text-sm font-medium hover:bg-fg hover:text-bg transition-colors"
        >
          <span>New conversation</span>
          <span className="text-lg leading-none">＋</span>
        </button>
      </div>

      <div className="px-4 pb-2">
        <p className="text-[10px] uppercase tracking-[0.16em] text-muted mt-3 mb-1 px-1">
          History
        </p>
      </div>
      <div className="px-3 flex-1 overflow-y-auto pb-4 min-h-0">
        <ConversationList
          conversations={conversations}
          activeId={activeId}
          onSelect={onSelect}
          loading={loading}
        />
      </div>

      {queueStatus && (
        <div className="px-4 py-3 border-t border-border">
          <div className="flex items-center gap-2">
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                active > 0 ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
              }`}
            />
            <span className="text-[10px] uppercase tracking-[0.14em] font-sans text-muted">
              {active > 0
                ? `${active} job${active === 1 ? '' : 's'} processing`
                : 'Queue idle'}
            </span>
          </div>
          {backoffLabel && queueStatus.backoff.state !== 'clear' && (
            <p className="text-[9px] font-sans text-muted mt-1 ml-3.5">
              {backoffLabel}
            </p>
          )}
        </div>
      )}
    </>
  );
}
