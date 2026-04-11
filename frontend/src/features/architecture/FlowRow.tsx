export function FlowRow({
  n,
  from,
  to,
  protocol,
  detail,
}: {
  n: number;
  from: string;
  to: string;
  protocol: string;
  detail: string;
}) {
  return (
    <div className="border-b border-border py-4 grid grid-cols-[2rem_1fr] gap-x-4">
      <span className="font-mono text-xs text-muted tabular-nums pt-0.5">{n}</span>
      <div>
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-sm font-sans font-medium">{from}</span>
          <span className="text-[10px] uppercase tracking-[0.12em] text-muted">→</span>
          <span className="text-sm font-sans font-medium">{to}</span>
          <span className="ml-auto text-[10px] uppercase tracking-[0.12em] font-sans text-muted">
            {protocol}
          </span>
        </div>
        <p className="text-xs text-muted leading-relaxed">{detail}</p>
      </div>
    </div>
  );
}
