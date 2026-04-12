const KEY = 'activeStream';

export interface ActiveStreamInfo {
  conversationId: number;
  jobId: string;
}

export function saveActiveStream(info: ActiveStreamInfo): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(info));
  } catch {}
}

export function loadActiveStream(): ActiveStreamInfo | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.conversationId === 'number' && typeof parsed.jobId === 'string') {
      return parsed as ActiveStreamInfo;
    }
  } catch {}
  return null;
}

export function clearActiveStream(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {}
}
