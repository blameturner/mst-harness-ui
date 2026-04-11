import type { CodeConversation } from '../../api/types/CodeConversation';

export function SidebarBody({
  sessions,
  sessionsLoading,
  conversationId,
  onNewSession,
  onSelectSession,
  onRenameSession,
  onPick,
}: {
  sessions: CodeConversation[];
  sessionsLoading: boolean;
  conversationId: number | null;
  onNewSession: () => void;
  onSelectSession: (c: CodeConversation) => void;
  onRenameSession: (c: CodeConversation) => void;
  onPick?: () => void;
}) {
  return (
    <>
      <div className="border-b border-border px-4 py-3 flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted">Code sessions</p>
        <button
          onClick={() => {
            onNewSession();
            onPick?.();
          }}
          className="text-[10px] uppercase tracking-[0.14em] font-sans border border-border px-2 py-1 rounded hover:border-fg hover:text-fg"
        >
          New
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1 min-h-0">
        {sessionsLoading ? (
          <p className="text-muted text-xs px-2 py-2">Loading…</p>
        ) : sessions.length === 0 ? (
          <p className="text-muted text-xs px-2 py-2">No sessions yet.</p>
        ) : (
          [...sessions]
            .sort((a, b) => {
              const aTime = a.UpdatedAt ? new Date(a.UpdatedAt).getTime() : 0;
              const bTime = b.UpdatedAt ? new Date(b.UpdatedAt).getTime() : 0;
              return bTime - aTime;
            })
            .map((c) => {
              const active = c.Id === conversationId;
              return (
                <div
                  key={c.Id}
                  className={`group w-full text-left px-2 py-1.5 rounded border transition truncate ${
                    active
                      ? 'bg-panelHi border-fg'
                      : 'bg-panel border-border hover:border-fg/60'
                  }`}
                >
                  <button
                    onClick={() => {
                      onSelectSession(c);
                      onPick?.();
                    }}
                    className="w-full text-left block"
                  >
                    <div className="text-[13px] font-medium truncate">
                      {c.title || 'Untitled'}
                    </div>
                    <div className="text-[9px] uppercase tracking-wider text-muted truncate flex items-center justify-between">
                      <span className="truncate">{c.model}</span>
                      <span className="ml-2 font-sans px-1 border border-border rounded">
                        {c.mode ?? 'plan'}
                      </span>
                    </div>
                  </button>
                  <button
                    onClick={() => onRenameSession(c)}
                    className="mt-1 text-[9px] uppercase tracking-[0.14em] text-muted hover:text-fg md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                  >
                    Rename
                  </button>
                </div>
              );
            })
        )}
      </div>
    </>
  );
}
