export function confidenceTone(score: number): {
  label: string;
  text: string;
  bg: string;
  bar: string;
} {
  if (score >= 81) {
    return {
      label: 'High',
      text: 'text-emerald-500',
      bg: 'bg-emerald-500/15 text-emerald-600',
      bar: 'bg-emerald-500',
    };
  }
  if (score >= 71) {
    return {
      label: 'Good',
      text: 'text-emerald-600',
      bg: 'bg-emerald-500/10 text-emerald-700',
      bar: 'bg-emerald-400',
    };
  }
  if (score >= 41) {
    return {
      label: 'Medium',
      text: 'text-amber-600',
      bg: 'bg-amber-500/15 text-amber-700',
      bar: 'bg-amber-500',
    };
  }
  return {
    label: 'Low',
    text: 'text-red-600',
    bg: 'bg-red-500/15 text-red-600',
    bar: 'bg-red-500',
  };
}

export const STATUS_TONES: Record<string, string> = {
  pending: 'bg-muted/30 text-muted',
  generating: 'bg-blue-500/15 text-blue-600',
  synthesizing: 'bg-indigo-500/15 text-indigo-600',
  critiquing: 'bg-amber-500/15 text-amber-700',
  complete: 'bg-emerald-500/15 text-emerald-700',
  completed: 'bg-emerald-500/15 text-emerald-700',
  failed: 'bg-red-500/15 text-red-600',
};

export function parseGapReport(raw?: string | null) {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as import('../../../../api/types/Enrichment').GapReport;
  } catch {
    return null;
  }
}
