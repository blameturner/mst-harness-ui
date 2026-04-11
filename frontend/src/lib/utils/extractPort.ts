export function extractPort(url: string): string {
  try {
    return new URL(url).port || '3900';
  } catch {
    return '3900';
  }
}
