import { useEffect, type ReactNode } from 'react';

interface SheetProps {
  open: boolean;
  side: 'left' | 'right';
  onClose: () => void;
  widthClass?: string;
  mobileOnlyClass?: string;
  children: ReactNode;
  label?: string;
}

export function Sheet({
  open,
  side,
  onClose,
  widthClass,
  mobileOnlyClass = 'md:hidden',
  children,
  label,
}: SheetProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

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
