import { useState } from 'react';

export interface HelpTooltipProps {
  label?: string;
  children: React.ReactNode;
}

/**
 * Minimal CSS tooltip. Hover or focus the (i) glyph to expand the help text
 * inline below it. Click toggles persistence.
 */
export function HelpTooltip({ label = 'i', children }: HelpTooltipProps) {
  const [pinned, setPinned] = useState(false);
  return (
    <span className="relative inline-block group">
      <button
        type="button"
        onClick={() => setPinned((p) => !p)}
        aria-label="Help"
        className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-border text-[9px] uppercase text-muted hover:text-fg hover:border-fg"
      >
        {label}
      </button>
      <span
        role="tooltip"
        className={[
          'absolute z-20 left-0 top-full mt-1 w-72 p-2 rounded border border-border bg-panel/95 text-[11px] leading-snug text-fg shadow-lg',
          pinned ? 'block' : 'hidden group-hover:block group-focus-within:block',
        ].join(' ')}
      >
        {children}
      </span>
    </span>
  );
}
