import type { StyleOption } from '../../api/types/StyleOption';

const runtimeStyleLabels = new Map<string, string>();

function humanizeStyleKey(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function registerStyleOptions(options: StyleOption[] | null | undefined): void {
  for (const option of options ?? []) {
    const label = option.label ?? option.display_name ?? humanizeStyleKey(option.key);
    runtimeStyleLabels.set(option.key, label);
  }
}

export function styleLabel(key: string | null | undefined): string {
  if (!key) return '';
  return runtimeStyleLabels.get(key) ?? humanizeStyleKey(key);
}
