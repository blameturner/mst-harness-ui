import { DATA_LAYER_INFO } from '../constants/DATA_LAYER_INFO';

export function matchDataInfo(containerName: string): { role: string; detail: string } | null {
  const n = containerName.toLowerCase();
  for (const [key, info] of Object.entries(DATA_LAYER_INFO)) {
    if (n.includes(key)) return info;
  }
  return null;
}
