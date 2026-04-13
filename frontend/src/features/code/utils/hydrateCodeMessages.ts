import type { CodeMessageRow } from '../../../api/types/CodeMessageRow';
import type { CodeMessage } from '../types/CodeMessage';
import { cleanUserContent } from './cleanUserContent';

export function hydrateCodeMessages(rows: CodeMessageRow[]): CodeMessage[] {
  return rows.filter((r) => r.role !== 'system').map((r) => ({
    id: String(r.Id),
    role: r.role === 'assistant' ? 'assistant' as const : 'user' as const,
    mode: (r.mode ?? 'plan') as any,
    content: r.role === 'user' ? cleanUserContent(r.content) : r.content,
    status: 'complete' as const,
    responseStyle: r.response_style ?? null,
  }));
}

