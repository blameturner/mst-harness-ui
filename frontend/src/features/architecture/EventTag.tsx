import type { ReactNode } from 'react';

export function EventTag({ children }: { children: ReactNode }) {
  return (
    <code className="font-mono text-[11px] text-fg border border-border px-1 py-px">
      {children}
    </code>
  );
}
