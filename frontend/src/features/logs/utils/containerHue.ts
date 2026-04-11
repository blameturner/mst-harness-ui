const hueCache = new Map<string, number>();

export function containerHue(name: string): number {
  let h = hueCache.get(name);
  if (h != null) return h;
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  h = ((hash % 360) + 360) % 360;
  hueCache.set(name, h);
  return h;
}
