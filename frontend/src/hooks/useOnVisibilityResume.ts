import { useEffect, useRef } from 'react';

export function useOnVisibilityResume(onResume: () => void) {
  const cb = useRef(onResume);
  useEffect(() => {
    cb.current = onResume;
  }, [onResume]);
  useEffect(() => {
    function handler() {
      if (!document.hidden) cb.current();
    }
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);
}
