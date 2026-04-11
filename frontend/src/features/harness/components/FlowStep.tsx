export function FlowStep({
  n, title, endpoint, detail,
}: { n: number; title: string; endpoint: string; detail: string }) {
  return (
    <div className="border-b border-border py-4 grid grid-cols-[2rem_1fr] gap-x-4">
      <span className="font-mono text-xs text-muted tabular-nums pt-0.5">{n}</span>
      <div>
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-sm font-sans font-medium">{title}</span>
          <span className="ml-auto font-mono text-[10px] text-muted">{endpoint}</span>
        </div>
        <p className="text-xs text-muted leading-relaxed">{detail}</p>
      </div>
    </div>
  );
}
