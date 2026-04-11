import { useRef, useState } from 'react';
import type { Codebase } from '../../api/types/Codebase';
import { createCodebase } from '../../api/codebases/createCodebase';
import { indexCodebase } from '../../api/codebases/indexCodebase';
import { listCodebases } from '../../api/codebases/listCodebases';

export function CodebaseManager({
  codebases,
  onUpdate,
}: {
  codebases: Codebase[];
  onUpdate: (cbs: Codebase[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [indexing, setIndexing] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function create() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const cb = await createCodebase({ name: name.trim(), description: description.trim() });
      onUpdate([...codebases, cb]);
      setName('');
      setDescription('');
      setCreating(false);
      setStatus(`Created "${cb.name}"`);
    } catch (err) {
      setStatus((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function uploadFiles(codebaseId: number, fileList: FileList) {
    setIndexing(codebaseId);
    setStatus(null);
    try {
      const files: Array<{ name: string; content: string }> = [];
      for (const f of Array.from(fileList)) {
        const text = await f.text();
        files.push({ name: f.webkitRelativePath || f.name, content: text });
      }
      const res = await indexCodebase(codebaseId, files);
      setStatus(`Indexed ${res.indexed} file${res.indexed !== 1 ? 's' : ''}`);
      const updated = await listCodebases();
      onUpdate(updated.codebases);
    } catch (err) {
      setStatus((err as Error).message);
    } finally {
      setIndexing(null);
    }
  }

  return (
    <div className="border-t border-border">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 sm:px-6 py-3 flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-muted hover:text-fg transition-colors"
      >
        <span>Codebases ({codebases.length})</span>
        <span>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-4 sm:px-6 pb-4 space-y-3">
          {codebases.map((cb) => (
            <div key={cb.id} className="flex items-center justify-between gap-2 py-1">
              <div className="min-w-0">
                <p className="text-[13px] font-medium truncate">{cb.name}</p>
                <p className="text-[10px] text-muted font-sans">
                  {cb.records} records · {cb.collection_name}
                </p>
              </div>
              <div className="shrink-0 flex items-center gap-1">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={indexing === cb.id}
                  className="text-[10px] uppercase tracking-[0.12em] font-sans border border-border px-2 py-1 rounded hover:border-fg hover:text-fg transition-colors disabled:opacity-50"
                >
                  {indexing === cb.id ? 'Indexing…' : 'Upload'}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      void uploadFiles(cb.id, e.target.files);
                    }
                    e.target.value = '';
                  }}
                />
              </div>
            </div>
          ))}

          {creating ? (
            <div className="space-y-2 border border-border rounded p-3 bg-panel/20">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Codebase name"
                className="w-full bg-transparent border border-border rounded px-2 py-1 text-[12px] font-mono outline-none focus:border-fg placeholder:text-muted/40"
              />
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description (optional)"
                className="w-full bg-transparent border border-border rounded px-2 py-1 text-[12px] font-mono outline-none focus:border-fg placeholder:text-muted/40"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => void create()}
                  disabled={saving || !name.trim()}
                  className="text-[10px] uppercase tracking-[0.12em] font-sans border border-fg px-3 py-1 rounded hover:bg-fg hover:text-bg transition-colors disabled:opacity-50"
                >
                  {saving ? 'Creating…' : 'Create'}
                </button>
                <button
                  onClick={() => setCreating(false)}
                  className="text-[10px] uppercase tracking-[0.12em] font-sans text-muted hover:text-fg px-2 py-1"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setCreating(true)}
              className="text-[10px] uppercase tracking-[0.12em] font-sans text-muted hover:text-fg"
            >
              + New codebase
            </button>
          )}

          {status && (
            <p className="text-[11px] font-sans text-muted">{status}</p>
          )}
        </div>
      )}
    </div>
  );
}
