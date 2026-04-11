import type { ChatIntent } from '../../api/types/ChatIntent';
import { INTENT_LAYOUT } from '../../api/constants/INTENT_LAYOUT';

export function typingLabelForIntent(intent: ChatIntent | null | undefined): string | null {
  if (!intent) return null;
  if (intent === 'research_synthesis') return 'Researching';
  const layout = INTENT_LAYOUT[intent];
  if (layout === 'expanded' || layout === 'collapsed') return 'Searching';
  return null;
}
