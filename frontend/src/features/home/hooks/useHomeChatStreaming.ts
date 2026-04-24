import { useSyncExternalStore } from 'react';
import { homeChatStore } from '../lib/homeChatStore';

/**
 * Global read-only indicator of whether any Home chat stream is active.
 * Safe to call from anywhere in the tree — the underlying store lives
 * outside the React component lifecycle, so this keeps working even when
 * the user has navigated away from /home.
 */
export function useHomeChatStreaming(): boolean {
  return useSyncExternalStore(
    homeChatStore.subscribe,
    () => homeChatStore.getSnapshot().streaming,
  );
}
