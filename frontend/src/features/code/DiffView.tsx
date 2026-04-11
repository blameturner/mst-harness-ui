import { useMemo } from 'react';
import { computeDiff } from './utils/computeDiff';

export function DiffView({ before, after }: { before: string; after: string }) {
  const rows = useMemo(() => computeDiff(before, after), [before, after]);
  return (
    <div className="grid grid-cols-2 text-[11.5px] font-mono border-t border-border max-h-[420px] overflow-auto">
      <div className="border-r border-border">
        {rows.map((r, i) =>
          r.kind === 'same' ? (
            <div key={i} className="px-2 whitespace-pre">{r.left || ' '}</div>
          ) : r.kind === 'del' ? (
            <div key={i} className="px-2 whitespace-pre bg-red-500/15 text-red-600">- {r.left || ' '}</div>
          ) : (
            <div key={i} className="px-2 whitespace-pre">&nbsp;</div>
          ),
        )}
      </div>
      <div>
        {rows.map((r, i) =>
          r.kind === 'same' ? (
            <div key={i} className="px-2 whitespace-pre">{r.right || ' '}</div>
          ) : r.kind === 'add' ? (
            <div key={i} className="px-2 whitespace-pre bg-green-500/15 text-green-700">+ {r.right || ' '}</div>
          ) : (
            <div key={i} className="px-2 whitespace-pre">&nbsp;</div>
          ),
        )}
      </div>
    </div>
  );
}
