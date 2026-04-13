import { useEffect, useRef } from 'react';
import type { StreamEvent } from '../../../api/types/StreamEvent';
import type { ChatMessageRow } from '../../../api/types/ChatMessageRow';
import type { DisplayMessage } from '../../../components/chat/DisplayMessage';
import { getConversationMessages } from '../../../api/chat/getConversationMessages';
import { loadActiveStream, clearActiveStream } from '../../../lib/activeStream';
import { replayStream } from '../../../api/replayStream';
import { isTransientNetworkError } from '../../../lib/network/isTransientNetworkError';
import { listModels } from '../../../api/models/listModels';
import { listConversations } from '../../../api/chat/listConversations';
import { listStyles } from '../../../api/styles/listStyles';
import { hydrateMessages } from '../lib/hydrateMessages';
import { useOnVisibilityResume } from '../../../hooks/useOnVisibilityResume';
import type { Conversation } from '../../../api/types/Conversation';

interface UseStreamRecoveryDeps {
  activeIdRef: React.RefObject<number | null>;
  model: string;
  setActiveId: (id: number | null) => void;
  setModel: (m: string) => void;
  setModels: (m: import('../../../api/types/LlmModel').LlmModel[]) => void;
  setMessages: React.Dispatch<React.SetStateAction<DisplayMessage[]>>;
  setSending: (v: boolean) => void;
  setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>;
  setLoadingConversations: (v: boolean) => void;
  setError: (e: string | null) => void;
  setChatStyles: (v: import('../../../api/types/StyleSurface').StyleSurface | null) => void;
  setStyleKey: (v: string) => void;
  setConversationTopics: (topics: string[]) => void;
  streamAbortRef: React.MutableRefObject<AbortController | null>;
  processStream: (
    stream: AsyncGenerator<StreamEvent, void, void>,
    pendingId: string,
    userText: string,
    isFirstMessage: boolean,
    controller: AbortController,
  ) => Promise<{ conversationId: number | null; consentNeeded: boolean }>;
}

export function useStreamRecovery(deps: UseStreamRecoveryDeps) {
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoadOkRef = useRef(false);

  function clearRetryTimer() {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }

  function scheduleRetry(convId: number) {
    clearRetryTimer();
    retryTimerRef.current = setTimeout(async () => {
      retryTimerRef.current = null;
      if (deps.activeIdRef.current !== convId) return;
      try {
        const res = await getConversationMessages(convId);
        if (deps.activeIdRef.current !== convId) return;
        const status = res.conversation?.status;
        if (status === 'processing') {
          deps.setMessages((ms) =>
            ms.map((x) => {
              if (x.id === `pending-${convId}` || x.id === `resume-${convId}`) {
                return { ...x, reconnecting: false };
              }
              return x;
            }),
          );
          scheduleRetry(convId);
        } else {
          clearActiveStream();
          const hydrated = hydrateMessages(res.messages);
          if (hydrated.topics.length) deps.setConversationTopics(hydrated.topics);
          deps.setMessages(hydrated.messages);
        }
      } catch {}
    }, 4000);
  }

  async function runInitialLoad() {
    try {
      const [convRes, modelsRes, stylesRes] = await Promise.all([
        listConversations(),
        listModels(),
        listStyles('chat').catch(() => null),
      ]);
      deps.setConversations(convRes.conversations.filter((c) => !c.deleted_at));
      deps.setModels(modelsRes.models);
      const reasoner = modelsRes.models.find((m) => m.role === 'reasoner');
      const defaultModel = reasoner?.name || modelsRes.models[0]?.name || '';
      if (defaultModel) deps.setModel(defaultModel);
      if (stylesRes?.chat) {
        deps.setChatStyles(stylesRes.chat);
        deps.setStyleKey(stylesRes.chat.default);
      }
      initialLoadOkRef.current = true;
      deps.setError(null);
    } catch (err) {
      if (isTransientNetworkError(err)) return;
      deps.setError((err as Error)?.message ?? 'Failed to load');
    } finally {
      deps.setLoadingConversations(false);
    }
  }

  async function resumeActiveStream() {
    const stored = loadActiveStream();
    if (!stored) return;

    const { conversationId, jobId } = stored;

    let res: { conversation: Conversation; messages: ChatMessageRow[] };
    try {
      res = await getConversationMessages(conversationId);
    } catch {
      clearActiveStream();
      return;
    }

    const convStatus = res.conversation?.status;

    if (convStatus !== 'processing') {
      clearActiveStream();
      deps.setActiveId(conversationId);
      deps.setModel(res.conversation?.model || deps.model);
      const hydrated = hydrateMessages(res.messages);
      if (hydrated.topics.length) deps.setConversationTopics(hydrated.topics);
      deps.setMessages(hydrated.messages);
      return;
    }

    const hasAssistantReply = res.messages.some(
      (m) => m.role === 'assistant' && m.content && m.content.length > 0,
    );

    deps.setActiveId(conversationId);
    deps.setModel(res.conversation?.model || deps.model);

    const loaded = hydrateMessages(res.messages);
    if (loaded.topics.length) deps.setConversationTopics(loaded.topics);
    const pendingId = `resume-${conversationId}`;
    deps.setMessages([...loaded.messages, {
      id: pendingId,
      role: 'assistant',
      content: '',
      status: 'pending',
      startedAt: Date.now(),
      reconnecting: true,
    }]);

    const controller = new AbortController();
    deps.streamAbortRef.current = controller;
    deps.setSending(true);

    let replayWorked = false;
    try {
      const stream = replayStream(jobId, controller.signal);
      const first = await stream.next();

      if (!first.done) {
        replayWorked = true;
        deps.setMessages((ms) =>
          ms.map((x) => x.id === pendingId ? { ...x, reconnecting: false } : x),
        );

        async function* prependFirst(
          firstVal: StreamEvent,
          rest: AsyncGenerator<StreamEvent, void, void>,
        ): AsyncGenerator<StreamEvent, void, void> {
          yield firstVal;
          yield* rest;
        }

        await deps.processStream(
          prependFirst(first.value, stream),
          pendingId,
          '',
          false,
          controller,
        );
      }
    } catch {}

    if (!replayWorked) {
      clearActiveStream();
      if (hasAssistantReply) {
        const hydrated = hydrateMessages(res.messages);
        if (hydrated.topics.length) deps.setConversationTopics(hydrated.topics);
        deps.setMessages(hydrated.messages);
        deps.setSending(false);
      } else {
        deps.setSending(false);
        scheduleRetry(conversationId);
      }
      return;
    }

    deps.setSending(false);
    if (deps.streamAbortRef.current === controller) {
      deps.streamAbortRef.current = null;
    }
  }

  useEffect(() => {
    void runInitialLoad().then(() => {
      void resumeActiveStream();
    });
    return () => {
      deps.streamAbortRef.current?.abort();
      clearRetryTimer();
    };
  }, []);

  useOnVisibilityResume(() => {
    if (!initialLoadOkRef.current) void runInitialLoad();
  });

  return { scheduleRetry, clearRetryTimer };
}
