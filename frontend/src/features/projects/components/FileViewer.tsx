import { useEffect, useState } from 'react';
import {
  aiFileSummary, fileDiff, listFileVersions, readProjectFile, restoreVersion,
  setLock, setPin, writeProjectFile,
} from '../../../api/projects/projects';
import type { ProjectFile, ProjectFileVersion } from '../../../api/projects/types';
import { Btn } from '../../../components/ui/Btn';
import { CodeEditor } from './CodeEditor';

export function FileViewer({
  projectId, path, onClose, onChanged,
}: {
  projectId: number;
  path: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [file, setFile] = useState<ProjectFile | null>(null);
  const [version, setVersion] = useState<ProjectFileVersion | null>(null);
  const [content, setContent] = useState('');
  const [editing, setEditing] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [diff, setDiff] = useState('');
  const [versions, setVersions] = useState<ProjectFileVersion[]>([]);
  const [savingErr, setSavingErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [summarising, setSummarising] = useState(false);

  const baseline = version?.content ?? '';
  const dirty = editing && content !== baseline;

  useEffect(() => {
    setEditing(false);
    setShowDiff(false);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, path]);

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  async function load() {
    const r = await readProjectFile(projectId, path);
    setFile(r.file);
    setVersion(r.current_version);
    setContent(r.current_version?.content ?? '');
  }

  async function loadDiff() {
    if (!version) return;
    const { unified } = await fileDiff(projectId, path);
    setDiff(unified);
  }

  async function loadVersions() {
    const r = await listFileVersions(projectId, path);
    setVersions(r.versions ?? []);
  }

  async function save() {
    if (saving) return;
    setSavingErr(null);
    setSaving(true);
    try {
      const r = await writeProjectFile(projectId, {
        path,
        content,
        edit_summary: 'manual edit',
        if_content_hash: version?.content_hash,
      });
      if (r.error) {
        setSavingErr(
          `Conflict — file changed externally (current hash ${r.actual?.slice(0, 8)}…). Reload and retry.`,
        );
        return;
      }
      setEditing(false);
      onChanged();
      load();
    } finally {
      setSaving(false);
    }
  }

  function cancelEdit() {
    if (dirty && !confirm('Discard unsaved changes?')) return;
    setEditing(false);
    setContent(version?.content ?? '');
    setSavingErr(null);
  }

  async function togglePin() {
    if (!file) return;
    await setPin(projectId, path, !file.pinned);
    load();
  }

  async function toggleLock() {
    if (!file) return;
    await setLock(projectId, path, !file.locked);
    load();
  }

  async function onRestore(v: number) {
    if (!confirm(`Restore version ${v} as current?`)) return;
    await restoreVersion(projectId, path, v);
    onChanged();
    load();
  }

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-border">
        <div className="flex items-center justify-between gap-3 px-4 py-2.5">
          <div className="flex min-w-0 items-baseline gap-2">
            <Crumbs path={path} />
            {version && (
              <span className="text-[10px] uppercase tracking-[0.16em] text-muted font-sans">
                v{version.version}
              </span>
            )}
            {file?.pinned && <Pill label="Pinned" />}
            {file?.locked && <Pill label="Locked" tone="warn" />}
            {dirty && <Pill label="● modified" tone="warn" />}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            <Btn variant="ghost" size="sm" onClick={togglePin}>{file?.pinned ? 'Unpin' : 'Pin'}</Btn>
            <Btn variant="ghost" size="sm" onClick={toggleLock}>{file?.locked ? 'Unlock' : 'Lock'}</Btn>
            <Btn
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowDiff((v) => !v);
                if (!showDiff) loadDiff();
              }}
            >
              {showDiff ? 'Hide diff' : 'Diff'}
            </Btn>
            <Btn variant="ghost" size="sm" onClick={loadVersions}>History</Btn>
            <Btn
              variant="ghost"
              size="sm"
              disabled={summarising}
              onClick={async () => {
                setSummarising(true);
                try {
                  const r = await aiFileSummary(projectId, path);
                  setSummary(r.summary);
                } finally {
                  setSummarising(false);
                }
              }}
            >
              {summarising ? '…' : 'Summarise'}
            </Btn>
            {!editing ? (
              <Btn
                variant="primary"
                size="sm"
                onClick={() => setEditing(true)}
                title="Edit (or double-click the content)"
              >
                Edit
              </Btn>
            ) : (
              <>
                <Btn
                  variant="primary"
                  size="sm"
                  onClick={save}
                  disabled={saving || !dirty}
                  title="⌘S to save"
                >
                  {saving ? 'Saving…' : 'Save'}
                </Btn>
                <Btn variant="ghost" size="sm" onClick={cancelEdit}>Cancel</Btn>
              </>
            )}
            <Btn variant="ghost" size="sm" onClick={onClose}>×</Btn>
          </div>
        </div>
        {file?.locked && editing && (
          <div className="border-t border-border bg-panel px-4 py-1.5 text-[10px] uppercase tracking-[0.16em] text-muted font-sans">
            File is locked — saving will fail until you unlock.
          </div>
        )}
      </header>

      {savingErr && (
        <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700 animate-fadeIn">
          {savingErr}
        </div>
      )}
      {summary !== null && (
        <div className="flex items-start justify-between gap-3 border-b border-border bg-panel px-4 py-2.5 animate-fadeIn">
          <div className="text-xs text-fg/85">
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted font-sans mr-2">Summary</span>
            {summary || <em className="text-muted">no summary returned</em>}
          </div>
          <button
            onClick={() => setSummary(null)}
            className="text-[10px] uppercase tracking-[0.16em] font-sans text-muted hover:text-fg"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <div
          className="flex-1 overflow-hidden"
          onDoubleClick={() => {
            if (!editing && !showDiff && !file?.locked) setEditing(true);
          }}
        >
          {showDiff ? (
            <pre className="m-0 h-full overflow-auto whitespace-pre-wrap break-words bg-panel p-4 font-mono text-[11px] leading-5 text-fg/85">
              {diff || (
                <span className="text-muted">No diff against previous version.</span>
              )}
            </pre>
          ) : editing ? (
            <CodeEditor value={content} onChange={setContent} onSave={save} />
          ) : (
            <CodeEditor
              value={content}
              onChange={() => {}}
              readOnly
              placeholder="(empty file — double-click to start editing)"
            />
          )}
        </div>
        {versions.length > 0 && (
          <aside className="w-52 shrink-0 overflow-auto border-l border-border bg-panel/60">
            <header className="border-b border-border px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted font-sans">Versions</p>
            </header>
            <ul>
              {versions.map((v) => (
                <li key={v.Id} className="border-b border-border last:border-b-0">
                  <div className="flex items-start gap-2 px-3 py-2 text-xs hover:bg-panelHi">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-fg">v{v.version}</span>
                        {v.conversation_id && (
                          <span className="rounded-sm bg-panelHi px-1 text-[9px] uppercase tracking-[0.16em] text-muted font-sans">
                            agent
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-muted">
                        {v.edit_summary || '—'}
                      </p>
                    </div>
                    <button
                      onClick={() => onRestore(v.version)}
                      className="text-[10px] uppercase tracking-[0.16em] font-sans text-muted hover:text-fg"
                    >
                      Restore
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>
    </div>
  );
}

function Crumbs({ path }: { path: string }) {
  const segments = path.split('/').filter(Boolean);
  const file = segments.pop() || path;
  return (
    <div className="flex items-baseline gap-1 truncate">
      {segments.map((s, i) => (
        <span key={i} className="text-xs text-muted font-mono">
          {s}
          <span className="mx-0.5 text-muted/60">/</span>
        </span>
      ))}
      <span className="truncate text-sm font-mono text-fg">{file}</span>
    </div>
  );
}

function Pill({ label, tone = 'default' }: { label: string; tone?: 'default' | 'warn' }) {
  const cls =
    tone === 'warn'
      ? 'border-amber-300 bg-amber-50 text-amber-800'
      : 'border-border bg-panelHi text-muted';
  return (
    <span
      className={`rounded-sm border px-1.5 py-0.5 text-[9px] uppercase tracking-[0.18em] font-sans ${cls}`}
    >
      {label}
    </span>
  );
}
