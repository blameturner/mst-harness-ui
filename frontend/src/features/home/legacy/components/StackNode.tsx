export function StackNode({
  label, sub, highlight, active, onClick,
}: { label: string; sub: string; highlight?: boolean; active?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={[
        'flex flex-col items-center justify-center px-4 py-3 border rounded min-w-[90px] transition-all',
        active
          ? 'border-fg bg-fg text-bg ring-2 ring-fg/30 ring-offset-1 ring-offset-bg'
          : highlight
            ? 'border-fg bg-fg text-bg hover:ring-1 hover:ring-fg/30'
            : 'border-border bg-panel/40 hover:border-fg/40',
      ].join(' ')}
    >
      <span className="text-xs font-medium font-sans">{label}</span>
      <span className={`text-[10px] font-mono ${active || highlight ? 'text-bg/70' : 'text-muted'}`}>{sub}</span>
    </button>
  );
}
