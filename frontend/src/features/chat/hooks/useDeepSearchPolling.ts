import { useEffect } from 'react';
import type { DisplayMessage } from '../../../components/chat/DisplayMessage';
import { getQueueActive } from '../../../api/queue/getQueueActive';
import { getConversationMessages } from '../../../api/chat/getConversationMessages';
import { hydrateMessages } from '../lib/hydrateMessages';

export function useDeepSearchPolling(
  messages: DisplayMessage[],
  activeId: number | null,
  activeIdRef: React.RefObject<number | null>,
  setMessages: React.Dispatch<React.SetStateAction<DisplayMessage[]>>,
  setConversationTopics: (topics: string[]) => void,
) {
  const hasWaiting = messages.some(
    (m) => m.deepSearchStatus === 'waiting' || m.searchStatus === 'queued',
  );

  useEffect(() => {
    if (!hasWaiting || activeId == null) return;
    const convId = activeId;
    const timer = setInterval(async () => {
      if (activeIdRef.current !== convId) return;
      try {
        const qs = await getQueueActive({ conversation_id: convId });
        if (activeIdRef.current !== convId) return;

        if (qs.active > 0) {
          setMessages((ms) =>
            ms.map((m) =>
              m.deepSearchStatus === 'waiting'
                ? { ...m, deepSearchMessage: `Researching... ${qs.active} source${qs.active === 1 ? '' : 's'} remaining` }
                : m,
            ),
          );
        } else {
          setMessages((ms) =>
            ms.map((m) => {
              if (m.deepSearchStatus === 'waiting') {
                return { ...m, deepSearchStatus: 'done' as const, deepSearchMessage: undefined };
              }
              if (m.searchStatus === 'queued') {
                return { ...m, searchStatus: 'completed' as const };
              }
              return m;
            }),
          );
          try {
            const res = await getConversationMessages(convId);
            if (activeIdRef.current !== convId) return;
            const hydrated = hydrateMessages(res.messages);
            if (hydrated.topics.length) setConversationTopics(hydrated.topics);
            setMessages((prev) => {
              const existingIds = new Set(prev.map((x) => x.id));
              const isResultMsg = (x: DisplayMessage) =>
                x.content.startsWith('[Deep search result]') ||
                x.model === 'deep_search' ||
                x.model === 'research';
              const newResults = hydrated.messages.filter(
                (x) => isResultMsg(x) && !existingIds.has(x.id),
              );
              if (newResults.length === 0) return prev;
              return [...prev, ...newResults];
            });
          } catch {}
        }
      } catch {}
    }, 12_000);
    return () => clearInterval(timer);
  }, [hasWaiting, activeId]);
}
