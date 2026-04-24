import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { getConversationMessages } from '../../../api/chat/getConversationMessages';
import { isRateLimited, sendHomeChat } from '../../../api/home/mutations';
import { emitToast } from '../../../lib/toast/ToastHost';
import { homeChatStore, type HomeChatMessage } from '../lib/homeChatStore';

export type ChatMessage = HomeChatMessage;

export function useHomeChat(conversationId?: number | null) {
  const snapshot = useSyncExternalStore(
    homeChatStore.subscribe,
    homeChatStore.getSnapshot,
  );

  // Tell the store which conversation we're on so it can reset state when
  // the user switches conversations (rare on Home, but cheap to support).
  useEffect(() => {
    homeChatStore.setConversationId(conversationId ?? null);
  }, [conversationId]);

  // Seed history from the server whenever the conversation changes. The
  // store merges the seeded rows with any live streamed messages so we
  // never clobber an in-flight bubble.
  useEffect(() => {
    if (!conversationId) return;
    let active = true;
    getConversationMessages(conversationId)
      .then((res) => {
        if (!active) return;
        const seeded: HomeChatMessage[] = (res.messages ?? [])
          .filter((m) => m.role === 'user' || m.role === 'assistant')
          .map((m) => ({
            id: `h-${m.Id}`,
            role: m.role as 'user' | 'assistant',
            text: m.content || '',
            streaming: false,
            model: m.model ?? null,
          }));
        homeChatStore.seedFromServer(seeded);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [conversationId]);

  const attachStream = useCallback((jobId: string) => {
    homeChatStore.attachStream(jobId);
  }, []);

  const refresh = useCallback(() => {
    if (!conversationId) return;
    getConversationMessages(conversationId)
      .then((res) => {
        const seeded: HomeChatMessage[] = (res.messages ?? [])
          .filter((m) => m.role === 'user' || m.role === 'assistant')
          .map((m) => ({
            id: `h-${m.Id}`,
            role: m.role as 'user' | 'assistant',
            text: m.content || '',
            streaming: false,
            model: m.model ?? null,
          }));
        homeChatStore.seedFromServer(seeded);
      })
      .catch(() => {});
  }, [conversationId]);

  const send = useCallback(
    async (text: string, searchMode: 'disabled' | 'basic' | 'standard' = 'basic') => {
      const trimmed = text.trim();
      if (!trimmed || snapshot.streaming) return;

      homeChatStore.addUserMessage(trimmed);

      try {
        const { job_id } = await sendHomeChat({ message: trimmed, searchMode });
        homeChatStore.attachStream(job_id);
      } catch (err) {
        if (isRateLimited(err)) emitToast('Rate limited - slow down', 'error');
        else emitToast(`Chat failed: ${err instanceof Error ? err.message : 'unknown'}`, 'error');
      }
    },
    [snapshot.streaming],
  );

  return {
    messages: snapshot.messages,
    sending: snapshot.streaming,
    streaming: snapshot.streaming,
    send,
    attachStream,
    refresh,
  };
}
