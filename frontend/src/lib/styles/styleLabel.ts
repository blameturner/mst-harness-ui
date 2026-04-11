import { STYLE_LABELS } from './STYLE_LABELS';

export function styleLabel(key: string | null | undefined): string {
  if (!key) return '';
  return STYLE_LABELS[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
