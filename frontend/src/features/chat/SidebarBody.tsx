import type { Conversation } from '../../api/types/Conversation';
import { ConversationList } from '../../components/ConversationList';

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
    </>
  );
}
