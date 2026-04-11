import type { ChatIntent } from '../../api/types/ChatIntent';
import { INTENT_LABEL } from '../../api/constants/INTENT_LABEL';
import { INTENT_TONE } from '../../api/constants/INTENT_TONE';

interface Props {
  intent: ChatIntent;
}

export function IntentChip({ intent }: Props) {
  const label = INTENT_LABEL[intent];
  if (!label) return null;
  const tone = INTENT_TONE[intent];

  return (
    <span
      className={`inline-block text-[10px] uppercase tracking-[0.14em] font-sans px-2 py-0.5 rounded-full border ${tone}`}
    >
      {label}
    </span>
  );
}
