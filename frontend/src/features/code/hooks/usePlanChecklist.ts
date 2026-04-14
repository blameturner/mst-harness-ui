import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

export interface PlanChecklistState {
  checklist: string[];
  setChecklist: (v: string[]) => void;
  checked: Record<number, boolean>;
  setChecked: Dispatch<SetStateAction<Record<number, boolean>>>;
  reset: () => void;
}

export function usePlanChecklist(): PlanChecklistState {
  const [checklist, setChecklist] = useState<string[]>([]);
  const [checked, setChecked] = useState<Record<number, boolean>>({});

  function reset() {
    setChecklist([]);
    setChecked({});
  }

  return {
    checklist,
    setChecklist,
    checked,
    setChecked,
    reset,
  };
}

