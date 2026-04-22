// frontend/src/lib/toast/ToastHost.tsx
import { useEffect, useState } from 'react';

export type ToastKind = 'info' | 'success' | 'error';
export interface ToastItem {
  id: number;
  kind: ToastKind;
  text: string;
  ttl: number;
}

let counter = 0;
const listeners = new Set<(t: ToastItem) => void>();

export function emitToast(text: string, kind: ToastKind = 'info', ttl = 4000) {
  const t: ToastItem = { id: ++counter, text, kind, ttl };
  listeners.forEach((fn) => fn(t));
}

export function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const add = (t: ToastItem) => {
      setItems((s) => [...s, t]);
      window.setTimeout(() => setItems((s) => s.filter((x) => x.id !== t.id)), t.ttl);
    };
    listeners.add(add);
    return () => {
      listeners.delete(add);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          className={[
            'pointer-events-auto min-w-[220px] max-w-[360px] rounded border px-3 py-2 text-[13px] shadow',
            t.kind === 'success' && 'border-fg/40 bg-bg text-fg',
            t.kind === 'error' && 'border-red-500 bg-bg text-red-400',
            t.kind === 'info' && 'border-border bg-bg text-fg',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}
