// frontend/src/features/home/hooks/useOverview.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { getHomeOverview } from '../../../api/home/overview';
import { getHomeHealth } from '../../../api/home/health';
import type { HomeOverview, HomeHealth } from '../../../api/home/types';

interface State {
  overview: HomeOverview | null;
  health: HomeHealth | null;
  loading: boolean;
  error: string | null;
}

export function useOverview(pollMs = 60_000) {
  const [state, setState] = useState<State>({
    overview: null,
    health: null,
    loading: true,
    error: null,
  });
  const mounted = useRef(true);

  const refetch = useCallback(async () => {
    try {
      const [overview, health] = await Promise.all([getHomeOverview(), getHomeHealth()]);
      if (!mounted.current) return;
      setState({ overview, health, loading: false, error: null });
    } catch (err) {
      if (!mounted.current) return;
      setState((s) => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : String(err),
      }));
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    refetch();
    const iv = window.setInterval(refetch, pollMs);
    const onFocus = () => refetch();
    window.addEventListener('focus', onFocus);
    return () => {
      mounted.current = false;
      window.clearInterval(iv);
      window.removeEventListener('focus', onFocus);
    };
  }, [pollMs, refetch]);

  return { ...state, refetch };
}
