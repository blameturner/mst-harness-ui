import type { LogLevel } from '../types/LogLevel';

export function classifyLevel(text: string): LogLevel {
  const m = text.match(/\b(ERROR|FATAL|PANIC|WARN(?:ING)?|INFO|DEBUG|TRACE)\b/);
  if (!m) return 'other';
  const l = m[1];
  if (l === 'ERROR' || l === 'FATAL' || l === 'PANIC') return 'error';
  if (l === 'WARN' || l === 'WARNING') return 'warn';
  if (l === 'INFO') return 'info';
  return 'debug';
}
