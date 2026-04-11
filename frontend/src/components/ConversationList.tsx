import type { Conversation } from '../api/types/Conversation';

interface Props {
  conversations: Conversation[];
  activeId: number | null;
  onSelect: (c: Conversation) => void;
  loading: boolean;
}

export function ConversationList({ conversations, activeId, onSelect, loading }: Props) {
  if (loading) {
    return <p className="text-muted text-sm px-3 py-2">Loading…</p>;
  }
  if (conversations.length === 0) {
    return (
      <p className="text-muted text-sm px-3 py-2">
        No conversations yet. Start one below.
      </p>
    );
  }

  // Sort by most recently updated
  const sorted = [...conversations].sort((a, b) => {
    const aTime = a.UpdatedAt ? new Date(a.UpdatedAt).getTime() : 0;
    const bTime = b.UpdatedAt ? new Date(b.UpdatedAt).getTime() : 0;
    return bTime - aTime; // Descending order (most recent first)
  });

  return (
    <ul className="space-y-1">
      {sorted.map((c) => {
        const isActive = c.Id === activeId;
        return (
          <li key={c.Id}>
            <button
              onClick={() => onSelect(c)}
              className={`w-full text-left px-3 py-2 rounded border transition truncate ${
                isActive
                  ? 'bg-panelHi border-accent'
                  : 'bg-panel border-border hover:border-accentDim'
              }`}
              title={c.title || 'Untitled'}
            >
              <div className="text-sm font-medium truncate">{c.title || 'Untitled'}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted truncate">
                {c.model}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
