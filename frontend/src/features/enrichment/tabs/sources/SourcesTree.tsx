import type { ScrapeTarget } from '../../../../api/types/ScrapeTarget';
import { SourceRow } from './SourceRow';

export function SourcesTree({
  sources,
  agentName,
  onSelect,
  onToggleActive,
  onTrigger,
  onFlush,
  onRemove,
}: {
  sources: ScrapeTarget[];
  agentName: (id: number | null) => string | null;
  onSelect: (s: ScrapeTarget) => void;
  onToggleActive: (s: ScrapeTarget) => void;
  onTrigger: (id: number) => void;
  onFlush: (id: number) => void;
  onRemove: (id: number) => void;
}) {
  const childrenByParent = new Map<number, ScrapeTarget[]>();
  const rootSources: ScrapeTarget[] = [];

  for (const s of sources) {
    if (s.parent_target != null) {
      const list = childrenByParent.get(s.parent_target);
      if (list) list.push(s);
      else childrenByParent.set(s.parent_target, [s]);
    } else {
      rootSources.push(s);
    }
  }

  const rows: { source: ScrapeTarget; indent: boolean }[] = [];
  for (const root of rootSources) {
    rows.push({ source: root, indent: false });
    const children = childrenByParent.get(root.id);
    if (children) {
      for (const child of children) {
        rows.push({ source: child, indent: true });
      }
    }
  }
  // orphan children whose parent isn't in the list
  for (const s of sources) {
    if (s.parent_target != null && !rootSources.some((r) => r.id === s.parent_target)) {
      if (!rows.some((r) => r.source.id === s.id)) {
        rows.push({ source: s, indent: true });
      }
    }
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-[10px] uppercase tracking-[0.16em] text-muted font-sans border-b border-border">
          <th className="text-left py-2">name</th>
          <th className="text-left py-2">url</th>
          <th className="text-left py-2">category</th>
          <th className="text-left py-2">depth</th>
          <th className="text-left py-2">agent</th>
          <th className="text-left py-2">freq</th>
          <th className="text-left py-2">pw</th>
          <th className="text-left py-2">last scraped</th>
          <th className="text-left py-2">status</th>
          <th className="text-right py-2">chunks</th>
          <th className="text-right py-2">actions</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ source, indent }) => (
          <SourceRow
            key={source.id}
            source={source}
            indent={indent}
            agentName={agentName}
            onSelect={onSelect}
            onToggleActive={onToggleActive}
            onTrigger={onTrigger}
            onFlush={onFlush}
            onRemove={onRemove}
          />
        ))}
      </tbody>
    </table>
  );
}
