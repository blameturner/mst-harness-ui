import type { Conversation } from '../../../api/types/Conversation';
import { IconButton } from '../../../components/IconButton';

interface Props {
  activeConversation: Conversation | null;
  conversationTopics: string[];
  onOpenSidebar: () => void;
  drawerOpen: boolean;
  onToggleDrawer: () => void;
}

export function ChatHeader({
  activeConversation,
  conversationTopics,
  onOpenSidebar,
  drawerOpen,
  onToggleDrawer,
}: Props) {
  return (
    <header className="border-b border-border bg-bg/80 backdrop-blur px-3 sm:px-6 md:px-8 py-3 md:py-5 flex items-center gap-3 md:gap-6">
      <div className="md:hidden">
        <IconButton onClick={onOpenSidebar} label="Open conversations">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="4" y1="7" x2="20" y2="7" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="17" x2="20" y2="17" />
          </svg>
        </IconButton>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted">
          {activeConversation ? 'Conversation' : 'Chat with Jeff'}
        </p>
        <h2 className="font-display text-base sm:text-lg md:text-xl font-semibold truncate tracking-tightest">
          {activeConversation?.title || 'Untitled'}
        </h2>
        {conversationTopics.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {conversationTopics.slice(0, 8).map((t) => (
              <span key={t} className="text-[9px] font-sans px-1.5 py-0.5 rounded-full border border-border text-muted bg-panel/40">
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 md:gap-3 shrink-0">
        <IconButton
          onClick={onToggleDrawer}
          label={drawerOpen ? 'Hide properties' : 'Show properties'}
          active={drawerOpen}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <line x1="12" y1="8" x2="12" y2="8.01" />
            <line x1="11" y1="12" x2="12" y2="12" />
            <line x1="12" y1="12" x2="12" y2="16" />
            <line x1="11" y1="16" x2="13" y2="16" />
          </svg>
        </IconButton>
      </div>
    </header>
  );
}
