import type { PlannedSearchQuery } from './types';

export interface ParsedProposal {
  messageId: number;
  queries: PlannedSearchQuery[];
}

const MARKER = '[planned_search]';

export function isProposalContent(content: string): boolean {
  return content.trimStart().startsWith(MARKER);
}

export function parseProposal(content: string): ParsedProposal | null {
  if (!isProposalContent(content)) return null;

  const idMatch = content.match(/\[message_id:(\d+)\]\s*$/);
  if (!idMatch) return null;
  const messageId = Number(idMatch[1]);
  if (!Number.isFinite(messageId)) return null;

  const body = content
    .slice(content.indexOf(MARKER) + MARKER.length, idMatch.index)
    .trim();

  const queries: PlannedSearchQuery[] = [];
  for (const rawLine of body.split('\n')) {
    const line = rawLine.trim();
    if (!line.startsWith('-')) continue;
    const stripped = line.replace(/^-\s*/, '');
    const reasonMatch = stripped.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
    if (reasonMatch) {
      queries.push({ query: reasonMatch[1].trim(), reason: reasonMatch[2].trim() });
    } else {
      queries.push({ query: stripped, reason: '' });
    }
  }

  return { messageId, queries };
}
