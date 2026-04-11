export function StackArrow({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-2 min-w-[60px]">
      <span className="text-[9px] uppercase tracking-[0.1em] text-muted font-sans mb-0.5">{label}</span>
      <div className="w-full h-px bg-border relative">
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0 h-0 border-l-[5px] border-l-border border-y-[3px] border-y-transparent" />
      </div>
    </div>
  );
}
