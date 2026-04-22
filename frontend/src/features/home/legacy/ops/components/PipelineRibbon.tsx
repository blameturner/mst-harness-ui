import type { PipelineSummary } from '../../../../../api/types/PipelineSummary';
import { PipelineCard } from './PipelineCard';

export type PipelineStage = 'discover_agent' | 'suggestions' | 'pathfinder' | 'scraper';

export interface PipelineRibbonProps {
  pipeline?: PipelineSummary;
  suggestionsCount?: number;
  scrapeTargetsCount?: number;
  triggersDisabled?: boolean;
  busy?: 'scraper' | 'pathfinder' | 'discover' | null;
  onKick: (kind: 'scraper' | 'pathfinder' | 'discover') => void;
  onFocusStage: (stage: PipelineStage) => void;
}

export function PipelineRibbon({
  pipeline,
  suggestionsCount,
  scrapeTargetsCount,
  triggersDisabled,
  busy,
  onKick,
  onFocusStage,
}: PipelineRibbonProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
      <PipelineCard
        kind="discover_agent"
        config={pipeline?.config?.discover_agent}
        schedule={pipeline?.schedule?.discover_agent}
        lastJob={pipeline?.last_jobs?.discover_agent}
        disabled={triggersDisabled}
        busy={busy === 'discover'}
        onKick={() => onKick('discover')}
        onFocus={() => onFocusStage('discover_agent')}
      />
      <SuggestionsTile
        count={suggestionsCount}
        onFocus={() => onFocusStage('suggestions')}
      />
      <PipelineCard
        kind="pathfinder"
        config={pipeline?.config?.pathfinder}
        schedule={pipeline?.schedule?.pathfinder}
        lastJob={pipeline?.last_jobs?.pathfinder}
        disabled={triggersDisabled}
        busy={busy === 'pathfinder'}
        onKick={() => onKick('pathfinder')}
        onFocus={() => onFocusStage('pathfinder')}
      />
      <PipelineCard
        kind="scraper"
        config={pipeline?.config?.scraper}
        schedule={pipeline?.schedule?.scraper}
        lastJob={pipeline?.last_jobs?.scraper}
        disabled={triggersDisabled}
        busy={busy === 'scraper'}
        onKick={() => onKick('scraper')}
        onFocus={() => onFocusStage('scraper')}
        stageBadge={
          scrapeTargetsCount != null
            ? { label: `${scrapeTargetsCount} pile`, tone: 'muted' }
            : undefined
        }
      />
    </div>
  );
}

// The Suggestions stage has no Huey job of its own — it is gated by user review —
// so we render a dedicated tile instead of a PipelineCard.
function SuggestionsTile({
  count,
  onFocus,
}: {
  count: number | undefined;
  onFocus: () => void;
}) {
  const pending = count ?? 0;
  return (
    <div
      className="border border-border rounded p-3 space-y-2 min-w-[14rem] cursor-pointer hover:border-fg transition-colors"
      onClick={onFocus}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onFocus();
        }
      }}
    >
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.16em] text-muted">Suggestions</p>
        <span
          className={[
            'px-1.5 py-0.5 rounded text-[9px] uppercase tracking-[0.12em]',
            pending > 0 ? 'bg-amber-500/20 text-amber-300' : 'bg-panel text-muted',
          ].join(' ')}
        >
          {pending} pending
        </span>
      </div>
      <p className="text-muted text-[11px] uppercase tracking-[0.14em]">Action</p>
      <p className="text-fg text-sm">
        {pending === 0 ? 'No review needed' : `${pending} waiting for review`}
      </p>
      <p className="text-muted text-[11px]">
        Discover agent proposes URLs; approve to enqueue pathfinder_extract.
      </p>
    </div>
  );
}
