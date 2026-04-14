import { confidenceTone } from './confidence';

interface Props {
  score: number;
  threshold?: number;
  compact?: boolean;
}

export function ConfidenceMeter({ score, threshold, compact }: Props) {
  const tone = confidenceTone(score);
  const clamped = Math.max(0, Math.min(100, score));
  const thresholdPct = threshold != null ? Math.max(0, Math.min(100, threshold)) : null;

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] uppercase tracking-[0.1em] ${tone.bg}`}>
        <span className="font-mono">{Math.round(clamped)}%</span>
        <span className="opacity-60">{tone.label}</span>
      </span>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] uppercase tracking-[0.14em] text-muted">Confidence</span>
        <span className={`text-[11px] font-mono ${tone.text}`}>{Math.round(clamped)}% · {tone.label}</span>
      </div>
      <div className="relative h-1.5 rounded bg-border/60 overflow-hidden">
        <div className={`absolute inset-y-0 left-0 ${tone.bar} transition-[width]`} style={{ width: `${clamped}%` }} />
        {thresholdPct != null && (
          <div className="absolute inset-y-0 w-px bg-fg/60" style={{ left: `${thresholdPct}%` }} title={`Threshold: ${thresholdPct}%`} />
        )}
      </div>
    </div>
  );
}
