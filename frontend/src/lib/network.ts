import { useEffect, useRef } from 'react';

/**
 * True for the network-layer errors that iOS Safari raises when it
 * suspends a background tab and kills in-flight fetches. We want to
 * treat these as transient — don't surface a scary "Load failed"
 * banner, just re-drive the request on visibility return.
 *
 * Known patterns we accept:
 *   Safari / iOS:  TypeError "Load failed"
 *   Chrome:        TypeError "Failed to fetch"
 *   Firefox:       TypeError "NetworkError when attempting to fetch resource."
 */
export function isTransientNetworkError(err: unknown): boolean {
  if (!err) return false;
  const e = err as { name?: string; message?: string };
  if (e.name !== 'TypeError') return false;
  const msg = (e.message ?? '').toLowerCase();
  return (
    msg.includes('load failed') ||
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed')
  );
}

/**
 * Tracks the last time the page was hidden and exposes a helper that
 * returns true if we were hidden within the window we care about. iOS
 * fires `visibilitychange` as the tab suspends and again when you
 * return, so anything erroring within a second of a hidden → visible
 * transition is almost certainly a suspend/kill, not a real failure.
 */
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
    /** True if the page is hidden right now. */
    isHidden: () => document.hidden,
    /** True if the page resumed within `ms` of calling this. */
    justResumed: (ms = 1500) => Date.now() - lastResumedAt.current < ms,
    /** True if the page was hidden at any point since page load. */
    wasEverHidden: () => lastHiddenAt.current > 0,
  };
}

/**
 * Fires `onResume` whenever the page goes from hidden → visible. Used to
 * retry initial data loads that were killed by an iOS background
 * suspension.
 */
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
