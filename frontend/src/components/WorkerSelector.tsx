import type { Worker } from '../api/types/Worker';
import { ModelBadge } from './ModelBadge';

interface Props {
  workers: Worker[];
  active: Worker | null;
  onSelect: (w: Worker) => void;
  loading: boolean;
}

export function WorkerSelector({ workers, active, onSelect, loading }: Props) {
  if (loading) {
    return <p className="text-muted text-sm px-3 py-2">Loading workers…</p>;
  }
  if (workers.length === 0) {
    return (
      <div className="px-3 py-2 text-sm text-muted">
        No workers configured — add one.
      </div>
    );
  }
  return (
    <ul className="space-y-1">
      {workers.map((w) => {
        const isActive = active?.Id === w.Id;
        return (
          <li key={w.Id}>
            <button
              onClick={() => onSelect(w)}
              className={`w-full text-left px-3 py-2 rounded border transition ${
                isActive
                  ? 'bg-panelHi border-accent'
                  : 'bg-panel border-border hover:border-accentDim'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-sm">{w.display_name || w.name}</span>
                <ModelBadge model={w.model} />
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
