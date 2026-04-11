import { useEffect, useRef } from 'react';

export function useAutoScrollToBottom<T>(dep: T) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [dep]);
  return scrollRef;
}
