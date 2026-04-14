import type { ChatMessageRow } from '../../../api/types/ChatMessageRow';
import type { DisplayMessage } from '../../../components/chat/DisplayMessage';

export interface HydrationResult {
  messages: DisplayMessage[];
  topics: string[];
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

  const messages = msgs
    .filter((m) => m.role !== 'system')
    .map<DisplayMessage>((m) => ({
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
    }));

  return { messages, topics };
}
