import { useState } from 'react';

export interface PlanChecklistState {
  checklist: string[];
  setChecklist: (v: string[]) => void;
  checked: Record<number, boolean>;
  setChecked: (v: Record<number, boolean>) => void;
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

