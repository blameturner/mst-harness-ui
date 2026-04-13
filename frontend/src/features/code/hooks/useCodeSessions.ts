import { useState, useCallback, useRef } from 'react';
import type { CodeConversation } from '../../../api/types/CodeConversation';
import { listCodeConversations } from '../../../api/code/listCodeConversations';
import { renameCodeConversation } from '../../../api/code/renameCodeConversation';
import { deleteCodeConversation } from '../../../api/code/deleteCodeConversation';

const ACTIVE_CODE_SESSION_KEY = 'codeActiveSession';

export interface CodeSessionsState {
  sessions: CodeConversation[];
  setSessions: React.Dispatch<React.SetStateAction<CodeConversation[]>>;
  sessionsLoading: boolean;
  setSessionsLoading: React.Dispatch<React.SetStateAction<boolean>>;

  conversationId: number | null;
  setConversationId: React.Dispatch<React.SetStateAction<number | null>>;
  conversationIdRef: React.MutableRefObject<number | null>;

  renameTitle: string;
  setRenameTitle: (v: string) => void;
  renaming: boolean;
  renameError: string | null;

  refreshSessions: () => Promise<void>;
  selectSession: (c: CodeConversation, opts: { onSelect: () => void | Promise<void> }) => Promise<void>;
  renameSession: (c: CodeConversation, nextTitle: string) => Promise<void>;
  deleteSession: (id?: number) => Promise<void>;
  newSession: () => void;
  saveRename: (id: number) => Promise<void>;

  rememberActiveSession: (id: number | null, jobId?: string) => void;
  loadActiveCodeSession: () => { id: number; jobId?: string } | null;
}

export function useCodeSessions(): CodeSessionsState {
  const [sessions, setSessions] = useState<CodeConversation[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const conversationIdRef = useRef(conversationId);
  conversationIdRef.current = conversationId;

  const [renameTitle, setRenameTitle] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  function rememberActiveSession(id: number | null, jobId?: string) {
    try {
      if (id == null) {
        window.localStorage.removeItem(ACTIVE_CODE_SESSION_KEY);
      } else {
        const payload: { id: number; jobId?: string } = { id };
        if (jobId) payload.jobId = jobId;
        if (!jobId) {
          try {
            const prev = JSON.parse(window.localStorage.getItem(ACTIVE_CODE_SESSION_KEY) ?? '{}');
            if (prev.jobId) payload.jobId = prev.jobId;
          } catch {}
        }
        window.localStorage.setItem(ACTIVE_CODE_SESSION_KEY, JSON.stringify(payload));
      }
    } catch {}
  }

  function loadActiveCodeSession(): { id: number; jobId?: string } | null {
    try {
      const raw = window.localStorage.getItem(ACTIVE_CODE_SESSION_KEY);
      if (!raw) return null;
      const n = parseInt(raw, 10);
      if (String(n) === raw && Number.isFinite(n)) return { id: n };
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.id === 'number') return parsed;
    } catch {}
    return null;
  }

  const refreshSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const res = await listCodeConversations();
      setSessions(res.conversations ?? []);
    } catch (err) {
      console.error('[code] failed to load sessions', err);
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  async function selectSession(c: CodeConversation, opts: { onSelect: () => void | Promise<void> }) {
    setConversationId(c.Id);
    rememberActiveSession(c.Id);
    setRenameTitle(c.title || '');
    await opts.onSelect();
  }

  async function renameSession(c: CodeConversation, nextTitle: string) {
    try {
      await renameCodeConversation(c.Id, nextTitle);
      setSessions((prev) =>
        prev.map((s) => (s.Id === c.Id ? { ...s, title: nextTitle } : s)),
      );
    } catch (err) {
      throw err;
    }
  }

  async function deleteSession(id?: number) {
    const target = id ?? conversationId;
    if (target == null) return;
    const confirmed = window.confirm('Delete this code session? This cannot be undone.');
    if (!confirmed) return;
    try {
      await deleteCodeConversation(target);
      setSessions((prev) => prev.filter((s) => s.Id !== target));
      if (conversationId === target) {
        newSession();
      }
    } catch (err) {
      throw err;
    }
  }

  function newSession() {
    rememberActiveSession(null);
    setConversationId(null);
    setRenameTitle('');
  }

  async function saveRename(id: number) {
    const title = renameTitle.trim();
    if (!title) {
      setRenameError('Title cannot be empty');
      return;
    }
    setRenaming(true);
    setRenameError(null);
    try {
      await renameCodeConversation(id, title);
      setSessions((prev) =>
        prev.map((s) => (s.Id === id ? { ...s, title } : s)),
      );
      setRenameTitle(title);
    } catch (err) {
      setRenameError((err as Error)?.message ?? 'Rename failed');
      throw err;
    } finally {
      setRenaming(false);
    }
  }

  return {
    sessions,
    setSessions,
    sessionsLoading,
    setSessionsLoading,
    conversationId,
    setConversationId,
    conversationIdRef,
    renameTitle,
    setRenameTitle,
    renaming,
    renameError,
    refreshSessions,
    selectSession,
    renameSession,
    deleteSession,
    newSession,
    saveRename,
    rememberActiveSession,
    loadActiveCodeSession,
  };
}

