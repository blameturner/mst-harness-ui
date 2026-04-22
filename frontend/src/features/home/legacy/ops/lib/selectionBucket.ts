// frontend/src/features/hub/tabs/ops/lib/selectionBucket.ts
import type { SelectionBucket } from '../../../../../api/types/PipelineSummary';

export interface BucketStyle {
  label: string;
  className: string;
}

const STYLES: Record<SelectionBucket, BucketStyle> = {
  manual_due:        { label: 'manual due',        className: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' },
  manual_never:      { label: 'manual new',        className: 'bg-blue-500/15 text-blue-300 border border-blue-500/30' },
  auto_due:          { label: 'auto due',          className: 'bg-amber-500/15 text-amber-300 border border-amber-500/30' },
  auto_never:        { label: 'auto new',          className: 'bg-violet-500/15 text-violet-300 border border-violet-500/30' },
  auto_shallow_due:  { label: 'auto shallow due',  className: 'bg-amber-500/15 text-amber-300 border border-amber-500/30' },
  auto_shallow_never:{ label: 'auto shallow new',  className: 'bg-violet-500/15 text-violet-300 border border-violet-500/30' },
};

export function bucketStyle(value: unknown): BucketStyle | null {
  if (typeof value !== 'string') return null;
  if (value in STYLES) return STYLES[value as SelectionBucket];
  return { label: value, className: 'bg-panel text-muted border border-border' };
}
