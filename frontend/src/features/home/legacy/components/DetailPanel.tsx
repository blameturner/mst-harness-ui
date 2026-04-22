import type { ReactNode } from 'react';

export function DetailPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-3 border border-fg/20 rounded-md p-4 bg-panel/40 animate-in fade-in slide-in-from-top-1 duration-150">
      <h4 className="font-display text-sm mb-2">{title}</h4>
      <div className="text-xs text-muted leading-relaxed">{children}</div>
    </div>
  );
}
