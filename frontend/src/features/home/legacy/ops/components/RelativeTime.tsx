import { useEffect, useState } from 'react';
import { formatRelative, fmtWhen } from '../lib/formatters';

export interface RelativeTimeProps {
  iso?: string | null;
  /** Refresh cadence in ms. Default: 30s. */
  refreshMs?: number;
  /** When true, also render the absolute timestamp inline (small, after the relative bit). */
  showAbsolute?: boolean;
  className?: string;
}

export function RelativeTime({ iso, refreshMs = 30_000, showAbsolute, className }: RelativeTimeProps) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!iso) return;
    const id = window.setInterval(() => setTick((n) => n + 1), refreshMs);
    return () => window.clearInterval(id);
  }, [iso, refreshMs]);

  if (!iso) return <span className={className}>—</span>;
  return (
    <span className={className} title={fmtWhen(iso)}>
      {formatRelative(iso)}
      {showAbsolute && <span className="text-muted ml-1.5">({fmtWhen(iso)})</span>}
    </span>
  );
}
