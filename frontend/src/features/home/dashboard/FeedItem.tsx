// frontend/src/features/home/dashboard/FeedItem.tsx
import type { FeedItem as FeedItemT } from '../../../api/home/types';
import { formatRelative } from '../../../lib/utils/formatRelative';

interface Props {
  item: FeedItemT;
  onClick: (item: FeedItemT) => void;
}

const KIND_GLYPH: Record<FeedItemT['kind'], string> = {
  insight: '●',
  digest: '◯',
  question: '?',
  run: '∗',
};

const KIND_LABEL: Record<FeedItemT['kind'], string> = {
  digest: 'Digest',
  insight: 'Insight',
  question: 'Query',
  run: 'Run',
};

export function FeedItem({ item, onClick }: Props) {
  return (
    <button
      onClick={() => onClick(item)}
      className="group w-full text-left py-3 pl-3 pr-2 border-b border-border hover:bg-panel/60 transition-colors relative"
    >
      <span
        className="absolute left-0 top-2 bottom-2 w-[2px] bg-fg scale-y-0 group-hover:scale-y-100 origin-center transition-transform"
        aria-hidden
      />
      <div className="grid grid-cols-[auto_1fr_auto] items-baseline gap-3">
        <span
          className="text-muted font-display text-[15px] w-5 text-center tabular-nums"
          aria-hidden
        >
          {KIND_GLYPH[item.kind]}
        </span>
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-[10px] uppercase tracking-[0.18em] font-sans text-muted shrink-0">
              {KIND_LABEL[item.kind]}
            </span>
            <span className="h-px flex-1 bg-border max-w-[1.5rem] self-center" />
          </div>
          <div className="font-display text-[16px] sm:text-[17px] leading-snug text-fg mt-0.5">
            {item.title}
          </div>
          {item.snippet && (
            <div className="text-[12.5px] text-muted mt-1 line-clamp-2 font-sans leading-relaxed">
              {item.snippet}
            </div>
          )}
        </div>
        <span className="text-[11px] text-muted font-sans tabular-nums shrink-0 self-start mt-0.5">
          {formatRelative(item.created_at)}
        </span>
      </div>
    </button>
  );
}
