import type { AttachedFile } from '../types/AttachedFile';
import type { Codebase } from '../../../api/types/Codebase';
import { formatBytes } from '../../../lib/utils/formatBytes';

interface CodebaseFilesFooterProps {
  useCodebase: boolean;
  codebases: Codebase[];
  codebaseCollection: string;
  onCodebaseChange: (v: string) => void;
  files: AttachedFile[];
  onRemoveFile: (name: string) => void;
}

export function CodebaseFilesFooter({
  useCodebase,
  codebases,
  codebaseCollection,
  onCodebaseChange,
  files,
  onRemoveFile,
}: CodebaseFilesFooterProps) {
  return (
    <>
      {useCodebase && codebases.length > 0 && (
        <div className="px-4 py-2 border-t border-border bg-panel/30 flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-[0.14em] font-sans text-muted shrink-0">Codebase</span>
          <select
            value={codebaseCollection}
            onChange={(e) => onCodebaseChange(e.target.value)}
            className="bg-transparent border border-border rounded px-2 py-1 text-[12px] font-mono outline-none focus:border-fg text-fg"
          >
            <option value="">Select a codebase…</option>
            {codebases.map((cb) => (
              <option key={cb.id} value={cb.collection_name}>
                {cb.name} ({cb.records} records)
              </option>
            ))}
          </select>
        </div>
      )}
      {useCodebase && codebases.length === 0 && (
        <div className="px-4 py-2 border-t border-border bg-panel/30 text-[11px] font-sans text-muted">
          No codebases indexed yet. Create one from the code page settings.
        </div>
      )}
      {files.length > 0 && (
        <div className="px-4 py-2 border-t border-border bg-panel/20 flex flex-wrap gap-2">
          {files.map((f) => (
            <span
              key={f.name}
              className="text-[11px] font-sans px-2 py-1 rounded border border-border bg-panel/60 flex items-center gap-2"
            >
              {f.name}
              <span className="text-muted">{formatBytes(f.size)}</span>
              <button
                onClick={() => onRemoveFile(f.name)}
                className="text-muted hover:text-fg"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </>
  );
}

