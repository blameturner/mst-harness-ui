// frontend/src/features/home/dashboard/GreetingStrip.tsx
import { useState } from 'react';
import type { HomeHealth } from '../../../api/home/types';
import { formatSecondsSinceChat } from '../../../lib/utils/formatRelative';
import { useToast } from '../../../lib/toast/useToast';
import { runDigest, produceInsight, runBriefing } from '../../../api/home/mutations';
import { ProduceInsightPopover } from './ProduceInsightPopover';

interface Props {
  health: HomeHealth | null;
  onAfterMutate: () => void; // refetch overview
  onChatStream: (jobId: string) => void; // hand briefing stream to HomeChat
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toRoman(n: number): string {
  const pairs: [number, string][] = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
    [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let r = '';
  let x = n;
  for (const [v, s] of pairs) {
    while (x >= v) { r += s; x -= v; }
  }
  return r;
}

export function GreetingStrip({ health, onAfterMutate, onChatStream }: Props) {
  const toast = useToast();
  const [producing, setProducing] = useState(false);
  const [showInsight, setShowInsight] = useState(false);

  const now = new Date();
  const weekday = WEEKDAYS[now.getDay()];
  const day = String(now.getDate()).padStart(2, '0');
  const month = MONTHS[now.getMonth()];
  const romanYear = toRoman(now.getFullYear());

  async function handleDigest() {
    try {
      await runDigest();
      toast.success('Digest running');
      const start = Date.now();
      const iv = window.setInterval(() => {
        onAfterMutate();
        if (Date.now() - start > 90_000) window.clearInterval(iv);
      }, 5_000);
    } catch (err) {
      toast.error(`Digest failed: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }

  async function handleInsight(topicHint: string | null) {
    setShowInsight(false);
    setProducing(true);
    try {
      await produceInsight({ topicHint });
      toast.success('Insight queued — ~60s');
      window.setTimeout(onAfterMutate, 60_000);
    } catch (err) {
      toast.error(`Insight failed: ${err instanceof Error ? err.message : 'unknown'}`);
    } finally {
      setProducing(false);
    }
  }

  async function handleBrief() {
    try {
      const { job_id } = await runBriefing();
      onChatStream(job_id);
      toast.info('Briefing streaming into chat…');
    } catch (err) {
      toast.error(`Briefing failed: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }

  return (
    <section className="relative border-b border-border">
      {/* Subtle newsprint gradient */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white to-panel/60" />

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between px-4 sm:px-8 py-5 sm:py-7">
        {/* Masthead */}
        <div className="min-w-0">
          <div className="flex items-baseline gap-3">
            <span className="font-sans text-[10px] uppercase tracking-[0.24em] text-muted">
              {weekday}
            </span>
            <span className="h-px flex-1 bg-border max-w-[4rem]" />
          </div>
          <h1 className="mt-1 font-display italic font-medium tracking-tightest text-4xl sm:text-5xl leading-[0.9] text-fg">
            {day} <span className="not-italic">{month}</span>
          </h1>
          <div className="mt-1.5 font-display italic text-[13px] sm:text-[14px] text-muted">
            <span className="tracking-[0.08em]">{romanYear}</span>
            <span className="mx-2">·</span>
            <span>{formatSecondsSinceChat(health?.seconds_since_chat)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-stretch gap-2 relative">
          <button
            data-shortcut="brief"
            onClick={handleBrief}
            className="group relative bg-fg text-bg px-4 sm:px-5 py-2.5 text-[11px] sm:text-[12px] uppercase tracking-[0.16em] font-sans hover:bg-fg/90 transition-colors"
          >
            Brief me
            <span className="ml-2 font-display not-italic">›</span>
          </button>
          <button
            data-shortcut="digest"
            onClick={handleDigest}
            className="border border-border px-3 py-2 text-[11px] uppercase tracking-[0.14em] font-sans text-fg hover:border-fg transition-colors"
          >
            Digest
          </button>
          <div className="relative">
            <button
              disabled={producing}
              onClick={() => setShowInsight((v) => !v)}
              className="border border-border px-3 py-2 text-[11px] uppercase tracking-[0.14em] font-sans text-fg hover:border-fg disabled:opacity-50 transition-colors"
            >
              {producing ? 'Queuing…' : 'Insight'}
            </button>
            {showInsight && (
              <ProduceInsightPopover
                onSubmit={handleInsight}
                onClose={() => setShowInsight(false)}
              />
            )}
          </div>
        </div>
      </div>

      {/* Decorative rule with centered glyph */}
      <div className="relative flex items-center px-4 sm:px-8 pb-1">
        <div className="h-px flex-1 bg-border" />
        <span className="px-3 font-display text-muted text-[10px]">❋</span>
        <div className="h-px flex-1 bg-border" />
      </div>
    </section>
  );
}
