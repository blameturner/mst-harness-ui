// frontend/src/features/home/tabs/DashboardTab.tsx
import { useRef, useState } from 'react';
import type { FeedItem, HomeHealth, HomeOverview } from '../../../api/home/types';
import { GreetingStrip } from '../dashboard/GreetingStrip';
import { Feed } from '../dashboard/Feed';
import { QuestionsPanel } from '../dashboard/QuestionsPanel';
import { HomeChat, type HomeChatHandle } from '../dashboard/HomeChat';
import { SchedulesPanel } from '../dashboard/SchedulesPanel';
import { WidgetRail } from '../dashboard/WidgetRail';
import { DigestModal } from '../dashboard/modals/DigestModal';
import { InsightModal } from '../dashboard/modals/InsightModal';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

interface Props {
  overview: HomeOverview | null;
  health: HomeHealth | null;
  refetch: () => void;
}

export function DashboardTab({ overview, health, refetch }: Props) {
  const chatRef = useRef<HomeChatHandle>(null);
  const questionRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [digestModal, setDigestModal] = useState<{ date?: string } | null>(null);
  const [insightModal, setInsightModal] = useState<number | null>(null);

  useKeyboardShortcuts({
    onSlash: () => chatRef.current?.focusInput(),
    onB: () => document.querySelector<HTMLButtonElement>('[data-shortcut="brief"]')?.click(),
    onD: () => document.querySelector<HTMLButtonElement>('[data-shortcut="digest"]')?.click(),
  });

  function openFeedItem(item: FeedItem) {
    if (item.kind === 'digest') {
      setDigestModal({ date: item.ref.date as string | undefined });
      return;
    }
    if (item.kind === 'insight') {
      setInsightModal(item.id);
      return;
    }
    if (item.kind === 'question') {
      const el = questionRefs.current.get(item.id);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el?.querySelector<HTMLButtonElement>(`button[data-question-option="${item.id}"]`)?.focus();
    }
  }

  const pending = overview?.pending_questions ?? [];
  const schedules = overview?.schedules ?? [];
  const feedRefreshKey = [
    overview?.digest?.id ?? 0,
    overview?.recent_insights?.[0]?.id ?? 0,
    pending.length,
  ].join(':');

  return (
    <div className="flex flex-col">
      <GreetingStrip
        health={health}
        onAfterMutate={refetch}
        onChatStream={(jobId) => chatRef.current?.attachStream(jobId)}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_360px] gap-6 sm:gap-8 px-4 sm:px-8 py-5 sm:py-7">
        <main className="min-w-0 space-y-8 order-2 lg:order-2">
          {/* Questions sit on a warmer paper tint to read as a separate spread */}
          <div className="rounded-none bg-panel/60 border border-border px-4 sm:px-5 py-4">
            <QuestionsPanel
              questions={pending}
              onRefetch={refetch}
              onChatStream={(jobId) => chatRef.current?.attachStream(jobId)}
              registerScrollTarget={(id, el) => {
                if (el) questionRefs.current.set(id, el);
                else questionRefs.current.delete(id);
              }}
            />
          </div>
          <Feed onOpen={openFeedItem} refreshKey={feedRefreshKey} />
        </main>

        <aside className="space-y-6 order-3 lg:order-1">
          <SchedulesPanel schedules={schedules} />
          <WidgetRail overview={overview} refreshSignal={overview} />
        </aside>

        <aside className="h-[60vh] min-h-[400px] lg:h-[calc(100vh-240px)] lg:min-h-[500px] order-1 xl:order-3 lg:col-span-2 xl:col-span-1">
          <HomeChat ref={chatRef} conversationId={overview?.home_conversation?.id ?? null} />
        </aside>
      </div>

      {digestModal && <DigestModal date={digestModal.date} onClose={() => setDigestModal(null)} />}
      {insightModal != null && (
        <InsightModal id={insightModal} onClose={() => setInsightModal(null)} />
      )}
    </div>
  );
}
