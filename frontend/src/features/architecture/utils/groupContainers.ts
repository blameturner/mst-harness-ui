import type { DockerContainer } from '../../../api/types/DockerContainer';
import { inferContainerGroup } from '../../../lib/utils/inferContainerGroup';

export function groupContainers(
  containers: DockerContainer[],
): [string, DockerContainer[]][] {
  const groups = new Map<string, DockerContainer[]>();
  for (const c of containers) {
    const group = inferContainerGroup(c);
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push(c);
  }
  const order = ['Models', 'Services', 'Data', 'Proxy'];
  return [...groups.entries()].sort(
    (a, b) =>
      (order.indexOf(a[0]) === -1 ? 99 : order.indexOf(a[0])) -
      (order.indexOf(b[0]) === -1 ? 99 : order.indexOf(b[0])),
  );
}
