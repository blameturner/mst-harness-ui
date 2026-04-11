import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { SelectOption } from './SelectOption';

interface SelectProps<T extends string | number> {
  value: T | '';
  onChange: (v: T) => void;
  options: SelectOption<T>[];
  placeholder?: string;
  menuMinWidth?: number;
  position?: 'above' | 'below';
  className?: string;
  leading?: ReactNode;
  disabled?: boolean;
}

export function Select<T extends string | number>({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  menuMinWidth = 220,
  position = 'above',
  className,
  leading,
  disabled,
}: SelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState<number>(-1);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number } | null>(null);

  const activeIdx = options.findIndex((o) => o.value === value);
  const active = activeIdx >= 0 ? options[activeIdx] : null;

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    function compute() {
      const btn = btnRef.current;
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      if (position === 'above') {
        setPos({ left: r.left, bottom: window.innerHeight - r.top + 6 });
      } else {
        setPos({ left: r.left, top: r.bottom + 6 });
      }
    }
    compute();
    window.addEventListener('resize', compute);
    window.addEventListener('scroll', compute, true);
    return () => {
      window.removeEventListener('resize', compute);
      window.removeEventListener('scroll', compute, true);
    };
  }, [open, position]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        btnRef.current?.focus();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHover((h) => Math.min(options.length - 1, h + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHover((h) => Math.max(0, h - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (hover >= 0 && hover < options.length) {
          onChange(options[hover].value);
          setOpen(false);
          btnRef.current?.focus();
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, hover, options, onChange]);

  useEffect(() => {
    if (open) setHover(activeIdx >= 0 ? activeIdx : 0);
  }, [open, activeIdx]);

  const menuWidth = Math.max(menuMinWidth, 220);
  const leftClamped = pos
    ? Math.max(8, Math.min(pos.left, window.innerWidth - menuWidth - 8))
    : 0;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        title={active?.description}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={[
          'bg-panel/60 border border-border hover:border-fg/60 focus:border-fg focus:outline-none',
          'px-2.5 py-1.5 rounded text-[12px] text-fg transition-colors',
          'flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed',
          className ?? '',
        ].join(' ')}
      >
        {leading}
        <span className="truncate max-w-[180px]">
          {active ? active.label : <span className="text-muted">{placeholder}</span>}
        </span>
        <span className="text-muted text-[10px] ml-0.5">▾</span>
      </button>

      {open && pos && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[60] cursor-default"
          />
          <div
            role="listbox"
            style={{
              left: leftClamped,
              top: pos.top,
              bottom: pos.bottom,
              minWidth: menuWidth,
            }}
            className="fixed z-[70] max-h-[340px] overflow-y-auto border border-border bg-bg shadow-2xl rounded-md py-1"
          >
            {options.length === 0 ? (
              <p className="px-3 py-2 text-[12px] text-muted">No options</p>
            ) : (
              options.map((o, i) => {
                const isActive = o.value === value;
                const isHover = i === hover;
                return (
                  <button
                    key={String(o.value)}
                    type="button"
                    onClick={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                    onMouseEnter={() => setHover(i)}
                    title={o.description}
                    className={[
                      'w-full text-left px-3 py-1.5 text-[12px] flex items-center gap-2 transition-colors',
                      isHover ? 'bg-panelHi' : '',
                      isActive ? 'text-fg' : 'text-muted',
                    ].join(' ')}
                  >
                    <span
                      className={[
                        'w-1.5 h-1.5 rounded-full shrink-0',
                        isActive ? 'bg-fg' : 'bg-border',
                      ].join(' ')}
                    />
                    <span className="flex-1 truncate">{o.label}</span>
                    {o.hint && (
                      <span className="text-[10px] text-muted uppercase tracking-[0.14em]">
                        {o.hint}
                      </span>
                    )}
                    {isActive && !o.hint && (
                      <span className="text-[9px] uppercase tracking-[0.14em] text-muted">
                        active
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </>
      )}
    </>
  );
}
