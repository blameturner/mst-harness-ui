import type { SearchMode } from '../../../api/types/SearchMode';

interface Props {
  value: SearchMode;
  onChange: (mode: SearchMode) => void;
  disabled?: boolean;
}

const OPTIONS: { value: SearchMode; label: string; title: string }[] = [
  { value: 'standard', label: 'Standard', title: 'LLM-driven web search — thorough' },
  { value: 'basic', label: 'Basic', title: 'Fast heuristic web search — cheaper' },
  { value: 'disabled', label: 'Off', title: 'No web search' },
];

export function SearchModeSelector({ value, onChange, disabled }: Props) {
  return (
    <div
      role="radiogroup"
      aria-label="Web search mode"
      className="inline-flex items-center rounded-md border border-border bg-panel/40 p-0.5"
    >
      {OPTIONS.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            title={opt.title}
            className={[
              'text-[11px] font-sans px-2.5 py-1.5 rounded transition-colors',
              active
                ? 'bg-fg text-bg'
                : 'text-muted hover:text-fg',
              disabled ? 'opacity-50 cursor-not-allowed' : '',
            ].join(' ')}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
