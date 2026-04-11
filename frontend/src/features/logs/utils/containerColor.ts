import { containerHue } from './containerHue';

export function containerColor(name: string): string {
  return `hsl(${containerHue(name)}, 55%, 65%)`;
}
