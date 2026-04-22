const PALETTE: Record<string, string> = {
  discovered: 'bg-blue-500/20 text-blue-300',
  scraped: 'bg-emerald-500/20 text-emerald-300',
  ok: 'bg-emerald-500/20 text-emerald-300',
  completed: 'bg-emerald-500/20 text-emerald-300',
  processed: 'bg-emerald-500/20 text-emerald-300',
  queued: 'bg-amber-500/20 text-amber-300',
  scraping: 'bg-violet-500/20 text-violet-300',
  running: 'bg-violet-500/20 text-violet-300',
  failed: 'bg-red-500/20 text-red-400',
  error: 'bg-red-500/20 text-red-400',
  cancelled: 'bg-panel text-muted',
  rejected: 'bg-amber-500/20 text-amber-300',
  idle: 'bg-panel text-muted',
  no_chunks: 'bg-panel text-muted',
  no_queries: 'bg-panel text-muted',
};

export interface StatusChipProps {
  status?: string | null;
  className?: string;
  title?: string;
}

export function StatusChip({ status, className, title }: StatusChipProps) {
  const label = status ?? 'unknown';
  const palette = (status && PALETTE[status]) ?? 'bg-panel text-muted';
  return (
    <span
      title={title}
      className={[
        'inline-block px-2 py-0.5 rounded text-[10px] uppercase tracking-[0.1em]',
        palette,
        className ?? '',
      ].join(' ')}
    >
      {label}
    </span>
  );
}
