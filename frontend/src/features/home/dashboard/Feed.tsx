// frontend/src/features/home/dashboard/Feed.tsx
import { useEffect, useState, useCallback, useRef } from 'react';
import { listHomeFeed } from '../../../api/home/feed';
import type { FeedItem as FeedItemT } from '../../../api/home/types';
import { FeedItem } from './FeedItem';

interface Props {
  onOpen: (item: FeedItemT) => void;
  refreshKey?: string;
}

function oldestCreatedAt(items: FeedItemT[]): string | undefined {
  if (items.length === 0) return undefined;
  return items
    .map((i) => i.created_at)
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0];
}

export function Feed({ onOpen, refreshKey }: Props) {
  const [items, setItems] = useState<FeedItemT[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const itemsRef = useRef<FeedItemT[]>([]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const load = useCallback(async (append = false) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    try {
      const before = append ? oldestCreatedAt(itemsRef.current) : undefined;
      const res = await listHomeFeed({ limit: 25, before });
      if (append) {
        // Append, de-duplicating by kind+id
        const seen = new Set(itemsRef.current.map((i) => `${i.kind}:${i.id}`));
        const next = res.items.filter((i) => !seen.has(`${i.kind}:${i.id}`));
        const combined = [...itemsRef.current, ...next];
        setItems(combined);
        itemsRef.current = combined;
        if (res.items.length < 25 || next.length === 0) setHasMore(false);
      } else {
        setItems(res.items);
        itemsRef.current = res.items;
        setHasMore(res.items.length === 25);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    load(false);
  }, [load, refreshKey]);

  const Header = (
    <div className="flex items-baseline gap-2 pb-1">
      <span className="text-[10px] uppercase tracking-[0.22em] font-sans text-muted">
        The Digest
      </span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );

  if (loading) {
    return (
      <div>
        {Header}
        <div>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-20 border-b border-border animate-pulse bg-panel/40"
            />
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div>
        {Header}
        <div className="py-12 text-center">
          <p className="font-display italic text-lg text-muted">
            Nothing filed today.
          </p>
          <p className="font-sans text-[12px] text-muted/70 mt-2">
            Run a digest, or start a chat — it'll show up here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {Header}
      <div>
        {items.map((it) => (
          <FeedItem key={`${it.kind}-${it.id}`} item={it} onClick={onOpen} />
        ))}
      </div>
      {hasMore && (
        <button
          disabled={loadingMore}
          onClick={() => load(true)}
          className="w-full mt-3 py-2 text-[11px] uppercase tracking-[0.16em] text-muted hover:text-fg font-sans disabled:opacity-50 transition-colors"
        >
          {loadingMore ? 'Loading…' : 'Load more ›'}
        </button>
      )}
    </div>
  );
}
