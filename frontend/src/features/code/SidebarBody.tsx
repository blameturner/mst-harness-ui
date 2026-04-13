import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { CodeConversation } from '../../api/types/CodeConversation';

interface Props {
  sessions: CodeConversation[];
  sessionsLoading: boolean;
  conversationId: number | null;
  onNewSession: () => void;
  onSelectSession: (c: CodeConversation) => void;
  onRenameSession: (c: CodeConversation, nextTitle: string) => Promise<void> | void;
  onDeleteSession?: (id: number) => void;
  onPick?: () => void;
}

export function SidebarBody({
  sessions,
  sessionsLoading,
  conversationId,
  onNewSession,
  onSelectSession,
  onRenameSession,
  onDeleteSession,
  onPick,
}: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const sorted = useMemo(
    () =>
      [...sessions].sort((a, b) => {
        const aTime = a.UpdatedAt ? new Date(a.UpdatedAt).getTime() : 0;
        const bTime = b.UpdatedAt ? new Date(b.UpdatedAt).getTime() : 0;
        return bTime - aTime;
      }),
    [sessions],
  );

  // keep the active session in view when it changes
  useEffect(() => {
    if (conversationId == null || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLButtonElement>(
      `[data-session-id="${conversationId}"]`,
    );
    el?.scrollIntoView({ block: 'nearest' });
  }, [conversationId]);

  function focusIdx(i: number) {
    const btns = listRef.current?.querySelectorAll<HTMLButtonElement>('button[data-session-id]');
    btns?.[i]?.focus();
  }

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    if (sorted.length === 0) return;
    const btns = listRef.current?.querySelectorAll<HTMLButtonElement>('button[data-session-id]');
    if (!btns || btns.length === 0) return;
    const cur = document.activeElement as HTMLElement | null;
    const idx = Array.from(btns).findIndex((b) => b === cur);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusIdx(Math.min(btns.length - 1, (idx < 0 ? 0 : idx + 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusIdx(Math.max(0, idx - 1));
    } else if (e.key === 'Home') {
      e.preventDefault();
      focusIdx(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      focusIdx(btns.length - 1);
    }
  }

  async function commitRename(c: CodeConversation) {
    const next = renameValue.trim();
    setRenamingId(null);
    if (!next || next === c.title) return;
    try {
      await onRenameSession(c, next);
    } catch {}
  }

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
      <div
        ref={listRef}
        onKeyDown={onKey}
        role="listbox"
        aria-label="Code sessions"
        className="flex-1 overflow-y-auto p-2 space-y-1 min-h-0"
      >
        {sessionsLoading ? (
          <p className="text-muted text-xs px-2 py-2">Loading…</p>
        ) : sorted.length === 0 ? (
          <p className="text-muted text-xs px-2 py-2">No sessions yet.</p>
        ) : (
          sorted.map((c) => {
            const active = c.Id === conversationId;
            const isProcessing = c.status === 'processing';
            const isRenaming = renamingId === c.Id;
            return (
              <div
                key={c.Id}
                className={`group w-full text-left px-2 py-1.5 rounded border transition ${
                  active
                    ? 'bg-panelHi border-fg'
                    : 'bg-panel border-border hover:border-fg/60'
                }`}
              >
                {isRenaming ? (
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => void commitRename(c)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void commitRename(c);
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        setRenamingId(null);
                      }
                    }}
                    className="w-full bg-bg border border-border rounded px-1.5 py-0.5 text-[13px] font-medium outline-none focus:border-fg"
                    aria-label="Rename session"
                  />
                ) : (
                  <button
                    onClick={() => {
                      onSelectSession(c);
                      onPick?.();
                    }}
                    data-session-id={c.Id}
                    role="option"
                    aria-selected={active}
                    className="w-full text-left block focus:outline-none focus:ring-1 focus:ring-fg rounded"
                    title={c.title || 'Untitled'}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {isProcessing && (
                        <span
                          aria-label="processing"
                          title="This session is still running"
                          className="shrink-0 w-1.5 h-1.5 rounded-full bg-fg animate-pulse"
                        />
                      )}
                      <div className="text-[13px] font-medium truncate flex-1 min-w-0">
                        {c.title || 'Untitled'}
                      </div>
                    </div>
                    <div className="text-[9px] uppercase tracking-wider text-muted truncate flex items-center justify-between mt-0.5">
                      <span className="truncate">{c.model}</span>
                      <span className="ml-2 font-sans px-1 border border-border rounded">
                        {c.mode ?? 'plan'}
                      </span>
                    </div>
                  </button>
                )}
                {!isRenaming && (
                  <div className="flex items-center gap-3 mt-1">
                    <button
                      onClick={() => {
                        setRenameValue(c.title || '');
                        setRenamingId(c.Id);
                      }}
                      className="text-[9px] uppercase tracking-[0.14em] text-muted hover:text-fg md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 transition-opacity"
                    >
                      Rename
                    </button>
                    {onDeleteSession && (
                      <button
                        onClick={() => onDeleteSession(c.Id)}
                        className="text-[9px] uppercase tracking-[0.14em] text-muted hover:text-red-500 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 transition-opacity"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
