import { useEffect, useRef } from 'react';

export function useWasRecentlyHidden() {
  const lastHiddenAt = useRef<number>(0);
  const lastResumedAt = useRef<number>(0);

  useEffect(() => {
    function onVis() {
      const now = Date.now();
      if (document.hidden) {
        lastHiddenAt.current = now;
      } else {
        lastResumedAt.current = now;
      }
    }
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  return {
    isHidden: () => document.hidden,
    justResumed: (ms = 1500) => Date.now() - lastResumedAt.current < ms,
    wasEverHidden: () => lastHiddenAt.current > 0,
  };
}
