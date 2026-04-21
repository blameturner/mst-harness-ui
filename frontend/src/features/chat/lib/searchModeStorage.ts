import type { SearchMode } from '../../../api/types/SearchMode';
import { SEARCH_MODE_DEFAULT } from '../../../api/types/SearchMode';

const CONV_KEY = (id: number) => `searchMode:${id}`;
const LAST_KEY = 'searchMode:last';

function isMode(v: unknown): v is SearchMode {
  return v === 'disabled' || v === 'basic' || v === 'standard';
}

export function loadSearchMode(conversationId: number | null): SearchMode {
  try {
    if (conversationId != null) {
      const v = window.localStorage.getItem(CONV_KEY(conversationId));
      if (isMode(v)) return v;
    }
    const last = window.localStorage.getItem(LAST_KEY);
    if (isMode(last)) return last;
  } catch {}
  return SEARCH_MODE_DEFAULT;
}

export function saveSearchMode(conversationId: number | null, mode: SearchMode): void {
  try {
    if (conversationId != null) {
      window.localStorage.setItem(CONV_KEY(conversationId), mode);
    }
    window.localStorage.setItem(LAST_KEY, mode);
  } catch {}
}
