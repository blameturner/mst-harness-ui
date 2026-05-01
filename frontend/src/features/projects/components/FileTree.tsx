import { useMemo, useState } from 'react';
import type { ProjectFile } from '../../../api/projects/types';

interface Node {
  name: string;
  fullPath: string;
  isDir: boolean;
  children: Node[];
  file?: ProjectFile;
}

function buildTree(files: ProjectFile[]): Node {
  const root: Node = { name: '/', fullPath: '/', isDir: true, children: [] };
  for (const f of files) {
    const parts = (f.path || '').split('/').filter(Boolean);
    let cur = root;
    parts.forEach((part, i) => {
      const isLast = i === parts.length - 1;
      let next = cur.children.find((c) => c.name === part);
      if (!next) {
        next = {
          name: part,
          fullPath: '/' + parts.slice(0, i + 1).join('/'),
          isDir: !isLast,
          children: [],
          file: isLast ? f : undefined,
        };
        cur.children.push(next);
      }
      cur = next;
    });
  }
  function sort(node: Node) {
    node.children.sort((a, b) => Number(b.isDir) - Number(a.isDir) || a.name.localeCompare(b.name));
    node.children.forEach(sort);
  }
  sort(root);
  return root;
}

export function FileTree({
  files,
  selected,
  onSelect,
  recentlyChanged,
}: {
  files: ProjectFile[];
  selected?: string;
  onSelect: (path: string) => void;
  recentlyChanged: Set<string>;
}) {
  const tree = useMemo(() => buildTree(files), [files]);
  const [filter, setFilter] = useState('');

  const filtered = useMemo(() => {
    if (!filter.trim()) return tree;
    const q = filter.toLowerCase();
    function visit(n: Node): Node | null {
      if (!n.isDir) {
        return n.fullPath.toLowerCase().includes(q) ? n : null;
      }
      const kids = n.children.map(visit).filter(Boolean) as Node[];
      if (kids.length === 0) return null;
      return { ...n, children: kids };
    }
    return visit(tree) ?? { ...tree, children: [] };
  }, [tree, filter]);

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-border px-3 py-2.5">
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted font-sans mb-1.5">
          Files · {files.length}
        </p>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter…"
          className="w-full rounded-sm border border-border bg-bg px-2 py-1 text-xs font-sans focus:outline-none focus:border-fg"
        />
      </header>
      <div className="flex-1 overflow-auto px-1.5 py-2">
        {filtered.children.length === 0 ? (
          <p className="px-3 py-4 text-center text-[11px] text-muted font-sans">
            {filter ? 'No files match.' : 'Empty project.'}
          </p>
        ) : (
          filtered.children.map((c) => (
            <NodeView
              key={c.fullPath}
              node={c}
              depth={0}
              selected={selected}
              onSelect={onSelect}
              recentlyChanged={recentlyChanged}
            />
          ))
        )}
      </div>
    </div>
  );
}

function NodeView({
  node,
  depth,
  selected,
  onSelect,
  recentlyChanged,
}: {
  node: Node;
  depth: number;
  selected?: string;
  onSelect: (path: string) => void;
  recentlyChanged: Set<string>;
}) {
  const [open, setOpen] = useState(depth < 2);

  if (node.isDir) {
    return (
      <div>
        <button
          onClick={() => setOpen((v) => !v)}
          style={{ paddingLeft: 8 + depth * 12 }}
          className="flex w-full items-center gap-1 py-0.5 text-left text-[11px] text-muted hover:text-fg transition-colors"
        >
          <Caret open={open} />
          <span className="font-sans uppercase tracking-[0.12em]">{node.name}</span>
        </button>
        {open &&
          node.children.map((c) => (
            <NodeView
              key={c.fullPath}
              node={c}
              depth={depth + 1}
              selected={selected}
              onSelect={onSelect}
              recentlyChanged={recentlyChanged}
            />
          ))}
      </div>
    );
  }

  const f = node.file!;
  const isSelected = selected === f.path;
  const changed = recentlyChanged.has(f.path);

  return (
    <button
      onClick={() => onSelect(f.path)}
      style={{ paddingLeft: 20 + depth * 12 }}
      className={[
        'group relative flex w-full items-center gap-1.5 truncate py-1 pr-2 text-left text-[12px] font-mono transition-colors rounded-sm',
        isSelected
          ? 'bg-fg text-bg'
          : 'text-fg/85 hover:bg-panelHi',
      ].join(' ')}
      title={f.path}
    >
      {changed && (
        <span
          aria-hidden
          className={[
            'absolute left-2 top-1/2 h-1 w-1 -translate-y-1/2 rounded-full',
            isSelected ? 'bg-bg/80' : 'bg-fg',
            'animate-pulse',
          ].join(' ')}
        />
      )}
      <span className="truncate">{node.name}</span>
      {f.pinned ? (
        <span
          aria-label="pinned"
          className={isSelected ? 'text-bg/70 text-[10px]' : 'text-muted text-[10px]'}
        >
          ●
        </span>
      ) : null}
      {f.locked ? (
        <span
          aria-label="locked"
          className={isSelected ? 'text-bg/70' : 'text-muted'}
        >
          <LockIcon />
        </span>
      ) : null}
    </button>
  );
}

function Caret({ open }: { open: boolean }) {
  return (
    <svg
      width="8"
      height="8"
      viewBox="0 0 8 8"
      className={`shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}
      aria-hidden
    >
      <path d="M2 1l4 3-4 3z" fill="currentColor" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 12 12" fill="none" aria-hidden>
      <rect x="2.5" y="5.5" width="7" height="5" rx="0.5" stroke="currentColor" strokeWidth="1" />
      <path d="M4 5.5V3.5a2 2 0 0 1 4 0v2" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}
