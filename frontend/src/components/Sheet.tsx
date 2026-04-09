import { useEffect, type ReactNode } from 'react';

interface SheetProps {
  open: boolean;
  side: 'left' | 'right';
  onClose: () => void;
  /** Width on ≥md. On mobile the sheet takes ~min(92vw, cap). */
  widthClass?: string;
  /** Hide on breakpoints where the panel should become a permanent column.
   *  Defaults to "md:hidden" — i.e. the sheet is mobile-only. Set to "" if
   *  you want it to work on all sizes (the code page's right rail does this
   *  at the sm..lg range). */
  mobileOnlyClass?: string;
  children: ReactNode;
  label?: string;
}

/**
 * Off-canvas panel used for the chat sidebar, chat properties drawer, and
 * code page sidebars/rails on small screens. Tap-backdrop to dismiss, ESC
 * to dismiss, body-scroll locked while open, focus trap left to the
 * browser's default — the content panels are scrollable regions themselves.
 */
export function Sheet({
  open,
  side,
  onClose,
  widthClass,
  mobileOnlyClass = 'md:hidden',
  children,
  label,
}: SheetProps) {
  // Dismiss on ESC.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Lock body scroll under the sheet.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const sideAnim = side === 'left' ? 'animate-sheet-left' : 'animate-sheet-right';
  const posClass =
    side === 'left'
      ? 'left-0 border-r border-border'
      : 'right-0 border-l border-border';
  const width = widthClass ?? 'w-[88vw] max-w-[340px]';

  return (
    <div className={`fixed inset-0 z-50 flex ${mobileOnlyClass}`} role="dialog" aria-label={label}>
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className={`absolute inset-0 bg-fg/40 backdrop-blur-sm animate-backdrop ${
          side === 'left' ? 'cursor-w-resize' : 'cursor-e-resize'
        }`}
      />
      <aside
        className={`relative ${posClass} ${width} bg-bg flex flex-col shadow-2xl ${sideAnim} ${
          side === 'right' ? 'ml-auto' : ''
        }`}
      >
        {children}
      </aside>
    </div>
  );
}

/** Standard burger / close icon button used in page headers. */
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
