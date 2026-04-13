import { useState } from 'react';
import type { Conversation } from '../../../api/types/Conversation';
import type { ConversationSummary } from '../../../api/types/ConversationSummary';
import { listConversations } from '../../../api/chat/listConversations';
import { getConversationMessages } from '../../../api/chat/getConversationMessages';
import { getConversationSummary } from '../../../api/chat/getConversationSummary';
import { renameConversation } from '../../../api/chat/renameConversation';
import { patchConversation } from '../../../api/chat/patchConversation';
import type { DisplayMessage } from '../../../components/chat/DisplayMessage';
import { hydrateMessages } from '../lib/hydrateMessages';

export interface ConversationsState {
  conversations: Conversation[];
  setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>;
  loadingConversations: boolean;
  activeId: number | null;
  setActiveId: (id: number | null) => void;
  activeConversation: Conversation | null;

  stats: ConversationSummary | null;
  setStats: (v: ConversationSummary | null) => void;
  loadingStats: boolean;

  drawerOpen: boolean;
  setDrawerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  sidebarOpen: boolean;
  setSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;

  renameTitle: string;
  setRenameTitle: (v: string) => void;
  renaming: boolean;
  renameError: string | null;

  conversationTopics: string[];
  setConversationTopics: (v: string[]) => void;

  refreshConversationList: () => Promise<void>;
  refreshStats: () => Promise<void>;
  selectConversation: (
    c: Conversation,
    opts: {
      model: string;
      chatStyles: { default: string } | null;
      setStyleKey: (k: string) => void;
      setMessages: React.Dispatch<React.SetStateAction<DisplayMessage[]>>;
      setError: (e: string | null) => void;
      scheduleRetry: (convId: number) => void;
      setModel: (m: string) => void;
    },
  ) => Promise<void>;
  newChat: (opts: {
    setMessages: React.Dispatch<React.SetStateAction<DisplayMessage[]>>;
    setError: (e: string | null) => void;
    setConsentRequest: (v: null) => void;
    clearRetryTimer: () => void;
  }) => void;
  saveRename: () => Promise<void>;
  deleteChat: (opts: {
    setMessages: React.Dispatch<React.SetStateAction<DisplayMessage[]>>;
    setError: (e: string | null) => void;
    setConsentRequest: (v: null) => void;
    clearRetryTimer: () => void;
  }) => Promise<void>;
  setLoadingConversations: (v: boolean) => void;
}

export function useConversations(): ConversationsState {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [activeId, setActiveId] = useState<number | null>(null);

  const [stats, setStats] = useState<ConversationSummary | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [renameTitle, setRenameTitle] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  const [conversationTopics, setConversationTopics] = useState<string[]>([]);
  const [error, setErrorLocal] = useState<string | null>(null);
  void error; // consumed via the opts pattern

  const activeConversation =
    activeId != null ? conversations.find((c) => c.Id === activeId) ?? null : null;

  async function refreshConversationList() {
    const res = await listConversations();
    setConversations(res.conversations.filter((c) => !c.deleted_at));
  }

  async function refreshStats() {
    if (activeId == null) {
      setStats(null);
      return;
    }
    setLoadingStats(true);
    try {
      const summary = await getConversationSummary(activeId);
      setStats(summary);
    } catch (err) {
      setErrorLocal((err as Error)?.message ?? 'Failed to load stats');
    } finally {
      setLoadingStats(false);
    }
  }

  async function selectConversation(
    c: Conversation,
    opts: {
      model: string;
      chatStyles: { default: string } | null;
      setStyleKey: (k: string) => void;
      setMessages: React.Dispatch<React.SetStateAction<DisplayMessage[]>>;
      setError: (e: string | null) => void;
      scheduleRetry: (convId: number) => void;
      setModel: (m: string) => void;
    },
  ) {
    setActiveId(c.Id);
    opts.setModel(c.model || opts.model);
    opts.setError(null);
    setStats(null);
    setConversationTopics([]);
    setRenameTitle(c.title || '');
    try {
      const saved = window.localStorage.getItem(`chatStyle:${c.Id}`);
      if (saved) opts.setStyleKey(saved);
      else if (opts.chatStyles) opts.setStyleKey(opts.chatStyles.default);
    } catch {}
    try {
      const res = await getConversationMessages(c.Id);
      const hydrated = hydrateMessages(res.messages);
      if (hydrated.topics.length) setConversationTopics(hydrated.topics);
      const convStatus = res.conversation?.status;

      if (convStatus === 'processing') {
        opts.setMessages([...hydrated.messages, {
          id: `pending-${c.Id}`,
          role: 'assistant',
          content: '',
          status: 'pending',
          startedAt: Date.now(),
          reconnecting: true,
        }]);
        opts.scheduleRetry(c.Id);
      } else if (convStatus === 'error') {
        opts.setMessages(hydrated.messages);
        opts.setError('The model encountered an error processing this conversation.');
      } else {
        opts.setMessages(hydrated.messages);
      }
    } catch (err) {
      opts.setError((err as Error)?.message ?? 'Failed to load conversation');
    }
  }

  function newChat(opts: {
    setMessages: React.Dispatch<React.SetStateAction<DisplayMessage[]>>;
    setError: (e: string | null) => void;
    setConsentRequest: (v: null) => void;
    clearRetryTimer: () => void;
  }) {
    opts.clearRetryTimer();
    setActiveId(null);
    opts.setMessages([]);
    opts.setError(null);
    setStats(null);
    setRenameTitle('');
    opts.setConsentRequest(null);
    setConversationTopics([]);
  }

  async function saveRename() {
    if (activeId == null) return;
    const title = renameTitle.trim();
    if (!title) {
      setRenameError('Title cannot be empty');
      return;
    }
    setRenaming(true);
    setRenameError(null);
    try {
      await renameConversation(activeId, title);
      setConversations((cs) =>
        cs.map((c) => (c.Id === activeId ? { ...c, title } : c)),
      );
      if (stats && stats.conversation.Id === activeId) {
        setStats({ ...stats, conversation: { ...stats.conversation, title } });
      }
      setRenameTitle(title);
    } catch (err) {
      setRenameError((err as Error)?.message ?? 'Rename failed');
    } finally {
      setRenaming(false);
    }
  }

  async function deleteChat(opts: {
    setMessages: React.Dispatch<React.SetStateAction<DisplayMessage[]>>;
    setError: (e: string | null) => void;
    setConsentRequest: (v: null) => void;
    clearRetryTimer: () => void;
  }) {
    if (activeId == null) return;
    const confirmed = window.confirm('Delete this conversation? This cannot be undone.');
    if (!confirmed) return;
    try {
      await patchConversation(activeId, { deleted_at: new Date().toISOString() });
      setConversations((cs) => cs.filter((c) => c.Id !== activeId));
      newChat(opts);
      setDrawerOpen(false);
    } catch (err) {
      opts.setError((err as Error)?.message ?? 'Delete failed');
    }
  }

  return {
    conversations, setConversations, loadingConversations, setLoadingConversations,
    activeId, setActiveId, activeConversation,
    stats, setStats, loadingStats,
    drawerOpen, setDrawerOpen, sidebarOpen, setSidebarOpen,
    renameTitle, setRenameTitle, renaming, renameError,
    conversationTopics, setConversationTopics,
    refreshConversationList, refreshStats,
    selectConversation, newChat, saveRename, deleteChat,
  };
}
