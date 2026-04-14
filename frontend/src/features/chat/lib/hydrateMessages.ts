import type { ChatMessageRow } from '../../../api/types/ChatMessageRow';
import type { DisplayMessage } from '../../../components/chat/DisplayMessage';
import type { SearchStatus } from '../../../api/types/SearchStatus';
import {
  isProposalContent,
  parseProposal,
} from '../../../lib/plannedSearch/parseProposal';
import type {
  PlannedSearchCardStatus,
  PlannedSearchState,
} from '../../../lib/plannedSearch/types';

export interface HydrationResult {
  messages: DisplayMessage[];
  topics: string[];
}

function cardStatusFor(
  pendingApproval: 0 | 1 | null | undefined,
  searchStatus: SearchStatus | undefined,
): PlannedSearchCardStatus {
  if (pendingApproval === 1) return 'proposed';
  if (searchStatus === 'completed') return 'completed';
  if (searchStatus === 'declined') return 'rejected';
  if (searchStatus === 'failed') return 'error';
  return 'proposed';
}

export function hydrateMessages(msgs: ChatMessageRow[]): HydrationResult {
  let topics: string[] = [];

  const summaryMsg = [...msgs].reverse().find(
    (m) => m.role === 'system' && m.content.startsWith('[Conversation summary]'),
  );
  if (summaryMsg) {
    const topicsMatch = summaryMsg.content.match(/TOPICS:\s*(.+)/);
    if (topicsMatch) {
      topics = topicsMatch[1].split(',').map((t) => t.trim()).filter(Boolean);
    }
  }

  const visible = msgs.filter((m) => m.role !== 'system');

  const answerByProposal = new Map<number, number>();
  for (let i = 0; i < visible.length; i++) {
    const row = visible[i];
    if (row.role !== 'assistant') continue;
    if (!isProposalContent(row.content)) continue;
    for (let j = i + 1; j < visible.length; j++) {
      const later = visible[j];
      if (later.role !== 'assistant') continue;
      if (later.model === 'planned_search_answer') {
        answerByProposal.set(row.Id, later.Id);
        break;
      }
    }
  }

  const messages = visible.map<DisplayMessage>((m) => {
    const base: DisplayMessage = {
      id: String(m.Id),
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
      model: m.model,
      status: m.role === 'system' ? 'system' : 'complete',
      tokensIn: m.tokens_input,
      tokensOut: m.tokens_output,
      responseStyle: m.response_style ?? null,
      sources: m.search_sources?.length ? m.search_sources : undefined,
      searchConfidence: m.search_confidence ?? undefined,
      searchContextText: m.search_context_text ?? undefined,
      intent: m.classification?.intent ?? m.intent ?? undefined,
      searchStatus: m.search_status,
    };

    if (m.role === 'assistant' && isProposalContent(m.content)) {
      const parsed = parseProposal(m.content);
      if (parsed) {
        const plannedSearch: PlannedSearchState = {
          proposalMessageId: parsed.messageId,
          queries: parsed.queries,
          status: cardStatusFor(m.pending_approval, m.search_status),
          answerMessageId: answerByProposal.get(m.Id),
        };
        return { ...base, plannedSearch };
      }
    }

    return base;
  });

  return { messages, topics };
}
