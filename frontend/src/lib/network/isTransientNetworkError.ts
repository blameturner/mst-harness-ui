// iOS Safari raises these when it suspends a background tab and kills in-flight fetches — treat as transient
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
