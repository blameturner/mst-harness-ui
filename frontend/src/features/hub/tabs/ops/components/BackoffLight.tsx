import type { QueueStatus } from '../../../../../api/types/QueueStatus';

export interface BackoffLightProps {
  backoff?: QueueStatus['backoff'];
}

export function BackoffLight({ backoff }: BackoffLightProps) {
  if (!backoff) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded border border-border text-[11px] uppercase tracking-[0.14em] text-muted">
        <Dot className="bg-border" />
        <span>backoff: —</span>
      </div>
    );
  }

  const { state, idle_seconds, threshold } = backoff;
  const isClear = state === 'clear';
  const dotClass = isClear ? 'bg-emerald-400' : 'bg-amber-400';
  const stateLabel = isClear ? 'clear' : 'waiting for idle';
  const idleLabel = idle_seconds < 0 ? 'no chat yet' : `${idle_seconds}s idle`;

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded border border-border text-[11px] uppercase tracking-[0.14em] text-muted"
      title={`Threshold ${threshold}s — background jobs run when idle_seconds ≥ threshold`}
    >
      <Dot className={dotClass} />
      <span className="text-fg">{stateLabel}</span>
      <span>· {idleLabel}</span>
      <span>· threshold {threshold}s</span>
    </div>
  );
}

function Dot({ className }: { className: string }) {
  return <span className={`inline-block w-2 h-2 rounded-full ${className}`} />;
}
