import type { ReactNode } from 'react';

export function IconButton({
  onClick,
  label,
  children,
  active,
}: {
  onClick: () => void;
  label: string;
  children: ReactNode;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={[
        'shrink-0 w-10 h-10 rounded-md border flex items-center justify-center transition-colors',
        active
          ? 'border-fg bg-fg text-bg'
          : 'border-border text-fg hover:bg-panelHi',
      ].join(' ')}
    >
      {children}
    </button>
  );
}
