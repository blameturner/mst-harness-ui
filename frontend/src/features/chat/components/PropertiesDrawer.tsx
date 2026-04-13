import type { ConversationSummary } from '../../../api/types/ConversationSummary';

interface Props {
  activeId: number | null;
  model: string;
  ragEnabled: boolean;
  knowledgeEnabled: boolean;
  alwaysAllowSearch: boolean;
  setAlwaysAllowSearch: (fn: (v: boolean) => boolean) => void;
  grounding: boolean;
  toggleGrounding: () => void;
  stats: ConversationSummary | null;
  loadingStats: boolean;
  refreshStats: () => void;
  renameTitle: string;
  setRenameTitle: (v: string) => void;
  renaming: boolean;
  renameError: string | null;
  saveRename: () => void;
  deleteChat: () => void;
  activeTitle: string;
  onClose: () => void;
}

export function PropertiesDrawer({
  activeId,
  model,
  ragEnabled,
  knowledgeEnabled,
  alwaysAllowSearch,
  setAlwaysAllowSearch,
  grounding,
  toggleGrounding,
  stats,
  loadingStats,
  refreshStats,
  renameTitle,
  setRenameTitle,
  renaming,
  renameError,
  saveRename,
  deleteChat,
  activeTitle,
  onClose,
}: Props) {
  return (
    <>
      <button
        type="button"
        aria-label="Close properties"
        onClick={onClose}
        className="md:hidden fixed inset-0 z-40 bg-fg/40 backdrop-blur-sm animate-backdrop"
      />
      <aside className="z-50 fixed inset-y-0 right-0 w-[92vw] max-w-[380px] md:static md:inset-auto md:w-[380px] shrink-0 border-l border-border bg-bg md:bg-panel/40 flex flex-col animate-sheet-right md:animate-fadeIn">
        <header className="shrink-0 flex items-start justify-between px-5 py-4 border-b border-border">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted">Chat</p>
            <h3 className="font-display text-lg font-semibold tracking-tightest truncate">
              Properties
            </h3>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 w-9 h-9 -mr-2 rounded-md border border-border text-fg hover:bg-panelHi flex items-center justify-center text-xl leading-none"
            aria-label="Close properties"
          >
            x
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6 text-sm">
          <section>
            <h4 className="text-[10px] uppercase tracking-[0.18em] text-muted mb-2">Title</h4>
            <input
              value={renameTitle}
              onChange={(e) => setRenameTitle(e.target.value)}
              placeholder={activeTitle || 'Untitled'}
              disabled={activeId == null || renaming}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  saveRename();
                }
              }}
              className="w-full bg-bg border border-border rounded-md px-3 py-2 text-[14px] focus:outline-none focus:border-fg disabled:opacity-50"
            />
            <div className="flex items-center justify-between mt-2">
              <p className="text-[10px] font-sans text-muted">
                {renameError ? (
                  <span className="text-red-600">{renameError}</span>
                ) : (
                  'Enter to save'
                )}
              </p>
              <button
                type="button"
                onClick={saveRename}
                disabled={
                  activeId == null ||
                  renaming ||
                  !renameTitle.trim() ||
                  renameTitle.trim() === activeTitle
                }
                className="text-[10px] uppercase tracking-[0.14em] font-sans px-3 py-1 rounded border border-fg text-fg hover:bg-fg hover:text-bg transition-colors disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-fg disabled:cursor-not-allowed"
              >
                {renaming ? '...' : 'Save'}
              </button>
            </div>
          </section>

          <section>
            <h4 className="text-[10px] uppercase tracking-[0.18em] text-muted mb-2">Settings</h4>
            <dl className="grid grid-cols-2 gap-y-1.5 text-[12px] font-sans">
              <dt className="text-muted">Type of Jeff</dt>
              <dd className="text-right truncate">{model || '\u2014'}</dd>
              <dt className="text-muted">Memory</dt>
              <dd className="text-right">
                {activeId == null
                  ? ragEnabled ? 'on (first turn)' : 'off'
                  : (stats?.conversation as any)?.rag_enabled ? 'on' : 'sticky'}
              </dd>
              <dt className="text-muted">Knowledge</dt>
              <dd className="text-right">
                {activeId == null ? (knowledgeEnabled ? 'on (first turn)' : 'off') : 'sticky'}
              </dd>
              <dt className="text-muted">Search</dt>
              <dd className="text-right">
                {alwaysAllowSearch ? 'always on' : 'auto-detected'}
              </dd>
            </dl>
            <p className="text-[10px] font-sans text-muted mt-2 leading-relaxed">
              Memory / Knowledge are captured when the chat is first created.
              Search is auto-detected by the harness.
            </p>

            <ToggleSwitch
              label="Web search"
              description="Turn off to stop the model retrieving information from the internet"
              checked={alwaysAllowSearch}
              onToggle={() => setAlwaysAllowSearch((v) => !v)}
            />

            <ToggleSwitch
              label="Contextual grounding"
              description="Pull current facts when the model spots real-world entities"
              checked={grounding}
              disabled={activeId == null}
              onToggle={toggleGrounding}
            />
          </section>

          <StatsSection
            activeId={activeId}
            stats={stats}
            loadingStats={loadingStats}
            refreshStats={refreshStats}
          />

          {activeId != null && (
            <section>
              <h4 className="text-[10px] uppercase tracking-[0.18em] text-muted mb-2">Danger zone</h4>
              <button
                type="button"
                onClick={deleteChat}
                className="w-full text-[11px] uppercase tracking-[0.14em] font-sans px-3 py-2 rounded border border-red-600 text-red-600 hover:bg-red-600 hover:text-bg transition-colors"
              >
                Delete conversation
              </button>
            </section>
          )}

          {stats && stats.observations.length > 0 && (
            <CollapsibleList
              title={`Observations \u00b7 ${stats.observation_count}`}
              items={stats.observations}
              renderItem={(o) => (
                <li key={o.Id} className="border border-border rounded-md p-3 bg-bg">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="font-medium text-[13px] leading-snug">{o.title}</p>
                    <span
                      className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${
                        o.confidence === 'high'
                          ? 'border-fg text-fg'
                          : o.confidence === 'medium'
                            ? 'border-muted text-muted'
                            : 'border-border text-muted'
                      }`}
                    >
                      {o.confidence}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted leading-relaxed">{o.content}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    <span className="text-[10px] font-sans text-muted">
                      {o.type} \u00b7 {o.domain}
                    </span>
                    {o.agent_name && (
                      <span className="text-[10px] font-sans text-muted">
                        \u00b7 {o.agent_name}
                      </span>
                    )}
                  </div>
                </li>
              )}
            />
          )}

          {stats && stats.runs.length > 0 && (
            <CollapsibleList
              title={`Agent runs \u00b7 ${stats.run_count}`}
              items={stats.runs}
              renderItem={(r) => (
                <li key={r.Id} className="border border-border rounded-md p-3 bg-bg">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="font-medium text-[13px]">{r.agent_name}</p>
                    <span className="text-[10px] font-sans text-muted">{r.status}</span>
                  </div>
                  {r.summary && (
                    <p className="text-[11px] text-muted mb-2 leading-relaxed">{r.summary}</p>
                  )}
                  <dl className="grid grid-cols-3 gap-x-3 gap-y-0.5 text-[10px] font-sans text-muted">
                    <dt>in</dt>
                    <dd className="col-span-2 text-fg">{(r.tokens_input ?? 0).toLocaleString()}</dd>
                    <dt>out</dt>
                    <dd className="col-span-2 text-fg">{(r.tokens_output ?? 0).toLocaleString()}</dd>
                    {r.context_tokens != null && (
                      <>
                        <dt>ctx</dt>
                        <dd className="col-span-2 text-fg">{r.context_tokens.toLocaleString()}</dd>
                      </>
                    )}
                    <dt>time</dt>
                    <dd className="col-span-2 text-fg">{(r.duration_seconds ?? 0).toFixed(2)}s</dd>
                    {r.model_name && (
                      <>
                        <dt>model</dt>
                        <dd className="col-span-2 text-fg truncate">{r.model_name}</dd>
                      </>
                    )}
                  </dl>
                </li>
              )}
            />
          )}

          {stats && stats.outputs.length > 0 && (
            <CollapsibleList
              title={`Outputs \u00b7 ${stats.output_count}`}
              items={stats.outputs}
              renderItem={(o) => (
                <li key={o.Id} className="border border-border rounded-md p-3 bg-bg">
                  <p className="text-[10px] uppercase tracking-wider text-muted mb-1">
                    {o.agent_name ?? `run #${o.run_id}`}
                  </p>
                  <p className="text-[11px] leading-relaxed whitespace-pre-wrap">{o.full_text}</p>
                </li>
              )}
            />
          )}
        </div>
      </aside>
    </>
  );
}

function ToggleSwitch({
  label,
  description,
  checked,
  disabled,
  onToggle,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="mt-3 flex items-center justify-between gap-2 text-[11px] font-sans text-fg cursor-pointer select-none">
      <span>
        <span className="text-muted uppercase tracking-[0.14em] text-[10px] block">{label}</span>
        <span className="text-[10px] text-muted">{description}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={onToggle}
        className={[
          'relative w-9 h-5 rounded-full border transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed',
          checked ? 'bg-fg border-fg' : 'bg-bg border-border',
        ].join(' ')}
      >
        <span
          className={[
            'absolute top-0.5 w-3.5 h-3.5 rounded-full transition-transform',
            checked ? 'left-0.5 translate-x-4 bg-bg' : 'left-0.5 bg-fg',
          ].join(' ')}
        />
      </button>
    </label>
  );
}

function StatsSection({
  activeId,
  stats,
  loadingStats,
  refreshStats,
}: {
  activeId: number | null;
  stats: ConversationSummary | null;
  loadingStats: boolean;
  refreshStats: () => void;
}) {
  return (
    <details open className="group">
      <summary className="flex items-center justify-between mb-2 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <h4 className="text-[10px] uppercase tracking-[0.18em] text-muted">Stats</h4>
        <span className="text-muted text-[10px] transition-transform group-open:rotate-90">\u25b8</span>
      </summary>
      <div className="flex justify-end -mt-1 mb-2">
        <button
          onClick={refreshStats}
          disabled={activeId == null || loadingStats}
          className="text-[10px] uppercase tracking-[0.14em] font-sans text-fg hover:underline underline-offset-4 disabled:opacity-40"
        >
          {loadingStats ? '...' : 'Refresh'}
        </button>
      </div>

      {activeId == null ? (
        <p className="text-[11px] text-muted font-sans">Select a conversation.</p>
      ) : stats == null ? (
        <p className="text-[11px] text-muted font-sans">Tap refresh to load.</p>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-y-1 text-[11px] font-sans">
            <dt className="text-muted">messages</dt>
            <dd className="text-right">{stats.message_count}</dd>
            <dt className="text-muted">runs</dt>
            <dd className="text-right">{stats.run_count}</dd>
            <dt className="text-muted">observations</dt>
            <dd className="text-right">{stats.observation_count}</dd>
            <dt className="text-muted">tasks</dt>
            <dd className="text-right">{stats.task_count}</dd>

            <dt className="text-muted mt-2 pt-2 border-t border-border">tokens in</dt>
            <dd className="text-right mt-2 pt-2 border-t border-border">
              {stats.tokens_input.toLocaleString()}
            </dd>
            <dt className="text-muted">tokens out</dt>
            <dd className="text-right">{stats.tokens_output.toLocaleString()}</dd>
            <dt className="text-muted font-semibold">total</dt>
            <dd className="text-right font-semibold">{stats.tokens_total.toLocaleString()}</dd>

            {stats.run_duration_seconds > 0 && (
              <>
                <dt className="text-muted mt-2 pt-2 border-t border-border">run time</dt>
                <dd className="text-right mt-2 pt-2 border-t border-border">
                  {stats.run_duration_seconds.toFixed(2)}s
                </dd>
              </>
            )}
          </dl>

          {stats.models_used.length > 0 && (
            <div className="mt-3">
              <p className="text-[9px] uppercase tracking-[0.16em] text-muted mb-1">Models</p>
              <div className="flex flex-wrap gap-1">
                {stats.models_used.map((m) => (
                  <span key={m} className="text-[10px] font-sans px-1.5 py-0.5 rounded border border-border bg-bg">
                    {m}
                  </span>
                ))}
              </div>
            </div>
          )}

          {stats.themes.length > 0 && (
            <div className="mt-2">
              <p className="text-[9px] uppercase tracking-[0.16em] text-muted mb-1">Themes</p>
              <div className="flex flex-wrap gap-1">
                {stats.themes.map((t) => (
                  <span key={t} className="text-[10px] font-sans px-1.5 py-0.5 rounded-full border border-border bg-bg">
                    {t}
                    {stats.theme_counts[t] != null && (
                      <span className="text-muted ml-1">\u00b7{stats.theme_counts[t]}</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </details>
  );
}

function CollapsibleList<T>({
  title,
  items,
  renderItem,
}: {
  title: string;
  items: T[];
  renderItem: (item: T) => React.ReactNode;
}) {
  return (
    <details className="group">
      <summary className="flex items-center justify-between mb-2 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <h4 className="text-[10px] uppercase tracking-[0.18em] text-muted">{title}</h4>
        <span className="text-muted text-[10px] transition-transform group-open:rotate-90">\u25b8</span>
      </summary>
      <ul className="space-y-3">{items.map(renderItem)}</ul>
    </details>
  );
}
