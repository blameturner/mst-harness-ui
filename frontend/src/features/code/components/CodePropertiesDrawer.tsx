import type { CodeMessage } from '../types/CodeMessage';
import type { CodeBlock } from '../types/CodeBlock';
import { parseCodeBlocks } from '../utils/parseCodeBlocks';

interface CodePropertiesDrawerProps {
  open: boolean;
  onClose: () => void;
  conversationId: number | null;
  model: string;
  mode: string;
  messages: CodeMessage[];
  files: any[];
  renameTitle: string;
  onRenameTitle: (v: string) => void;
  renaming: boolean;
  renameError: string | null;
  onSaveRename: () => Promise<void>;
  onDeleteSession: () => Promise<void>;
  ragEnabled: boolean;
  knowledgeEnabled: boolean;
  searchEnabled: boolean;
  useCodebase: boolean;
  codebaseCollection: string;
  createdAt?: string;
}

export function CodePropertiesDrawer({
  open,
  onClose,
  conversationId,
  model,
  mode,
  messages,
  files,
  renameTitle,
  onRenameTitle,
  renaming,
  renameError,
  onSaveRename,
  onDeleteSession,
  ragEnabled,
  knowledgeEnabled,
  searchEnabled,
  useCodebase,
  codebaseCollection,
  createdAt,
}: CodePropertiesDrawerProps) {
  if (!open) return null;

  const msgCount = messages.length;
  const userCount = messages.filter((m) => m.role === 'user').length;
  const assistantCount = messages.filter((m) => m.role === 'assistant').length;
  const allBlocks = messages
    .filter((m) => m.role === 'assistant' && m.status === 'complete')
    .flatMap((m) => parseCodeBlocks(m.content));
  const totalBlocks = allBlocks.length;
  const fileCount = new Set(allBlocks.filter((b) => b.file).map((b) => b.file)).size;
  const langs = [...new Set(allBlocks.map((b) => b.lang))];

  return (
    <>
      <button
        type="button"
        aria-label="Close properties"
        onClick={onClose}
        className="md:hidden fixed inset-0 z-40 bg-fg/40 backdrop-blur-sm animate-backdrop"
      />
      <aside className="z-50 fixed inset-y-0 right-0 w-[92vw] max-w-[340px] md:static md:inset-auto md:w-[340px] shrink-0 border-l border-border bg-bg md:bg-panel/40 flex flex-col animate-sheet-right md:animate-fadeIn">
        <header className="shrink-0 flex items-start justify-between px-5 py-4 border-b border-border">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted">Code</p>
            <h3 className="font-display text-lg font-semibold tracking-tightest truncate">
              Properties
            </h3>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 w-9 h-9 -mr-2 rounded-md border border-border text-fg hover:bg-panelHi flex items-center justify-center text-xl leading-none"
            aria-label="Close properties"
          >
            ×
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6 text-sm">
          {/* Title */}
          <section>
            <h4 className="text-[10px] uppercase tracking-[0.18em] text-muted mb-2">Title</h4>
            <input
              value={renameTitle}
              onChange={(e) => onRenameTitle(e.target.value)}
              placeholder="Untitled"
              disabled={conversationId == null || renaming}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void onSaveRename(); } }}
              className="w-full bg-bg border border-border rounded-md px-3 py-2 text-[14px] focus:outline-none focus:border-fg disabled:opacity-50"
            />
            <div className="flex items-center justify-between mt-2">
              <p className="text-[10px] font-sans text-muted">
                {renameError ? <span className="text-red-600">{renameError}</span> : 'Enter to save'}
              </p>
              <button
                type="button"
                onClick={() => void onSaveRename()}
                disabled={conversationId == null || renaming || !renameTitle.trim()}
                className="text-[10px] uppercase tracking-[0.14em] font-sans px-3 py-1 rounded border border-fg text-fg hover:bg-fg hover:text-bg transition-colors disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-fg disabled:cursor-not-allowed"
              >
                {renaming ? '...' : 'Save'}
              </button>
            </div>
          </section>

          {/* Session info */}
          <section>
            <h4 className="text-[10px] uppercase tracking-[0.18em] text-muted mb-2">Session</h4>
            <dl className="grid grid-cols-2 gap-y-1.5 text-[12px] font-sans">
              <dt className="text-muted">Model</dt>
              <dd className="text-right truncate">{model || '—'}</dd>
              <dt className="text-muted">Mode</dt>
              <dd className="text-right">{mode}</dd>
              <dt className="text-muted">Messages</dt>
              <dd className="text-right">{msgCount} <span className="text-muted">({userCount}u / {assistantCount}a)</span></dd>
              <dt className="text-muted">Code blocks</dt>
              <dd className="text-right">{totalBlocks}</dd>
              {fileCount > 0 && (
                <>
                  <dt className="text-muted">Files touched</dt>
                  <dd className="text-right">{fileCount}</dd>
                </>
              )}
              <dt className="text-muted">Attached files</dt>
              <dd className="text-right">{files.length}</dd>
              {createdAt && (
                <>
                  <dt className="text-muted">Created</dt>
                  <dd className="text-right">{new Date(createdAt).toLocaleDateString()}</dd>
                </>
              )}
            </dl>
          </section>

          {/* Languages */}
          {langs.length > 0 && (
            <section>
              <h4 className="text-[10px] uppercase tracking-[0.18em] text-muted mb-2">Languages</h4>
              <div className="flex flex-wrap gap-1">
                {langs.map((l) => (
                  <span key={l} className="text-[10px] font-sans px-1.5 py-0.5 rounded border border-border bg-bg">
                    {l}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Settings */}
          <section>
            <h4 className="text-[10px] uppercase tracking-[0.18em] text-muted mb-2">Settings</h4>
            <dl className="grid grid-cols-2 gap-y-1.5 text-[12px] font-sans">
              <dt className="text-muted">Memory</dt>
              <dd className="text-right">{ragEnabled ? 'on' : 'off'}</dd>
              <dt className="text-muted">Knowledge</dt>
              <dd className="text-right">{knowledgeEnabled ? 'on' : 'off'}</dd>
              <dt className="text-muted">Web search</dt>
              <dd className="text-right">{searchEnabled ? 'on' : 'off'}</dd>
              <dt className="text-muted">Codebase</dt>
              <dd className="text-right truncate">{useCodebase && codebaseCollection ? codebaseCollection : 'off'}</dd>
            </dl>
          </section>

          {/* Danger zone */}
          {conversationId != null && (
            <section>
              <h4 className="text-[10px] uppercase tracking-[0.18em] text-muted mb-2">Danger zone</h4>
              <button
                type="button"
                onClick={() => void onDeleteSession()}
                className="w-full text-[11px] uppercase tracking-[0.14em] font-sans px-3 py-2 rounded border border-red-600 text-red-600 hover:bg-red-600 hover:text-bg transition-colors"
              >
                Delete session
              </button>
            </section>
          )}
        </div>
      </aside>
    </>
  );
}

