import type { ChatIntent } from '../../api/types/ChatIntent';
import type { IntentSourceLayout } from '../../api/types/IntentSourceLayout';
import { INTENT_LAYOUT } from '../../api/constants/INTENT_LAYOUT';

export function resolveSourceLayout(
  intent: ChatIntent | null | undefined,
  hasSources: boolean,
): IntentSourceLayout {
  if (!hasSources) return 'hidden';
  if (!intent) return 'collapsed';
  return INTENT_LAYOUT[intent];
}
