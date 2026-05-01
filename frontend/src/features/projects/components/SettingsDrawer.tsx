import { useEffect, useState } from 'react';
import { patchProject } from '../../../api/projects/projects';
import type { Project } from '../../../api/projects/types';
import { Btn } from '../../../components/ui/Btn';

export function SettingsDrawer({
  project, onClose, onSaved,
}: {
  project: Project;
  onClose: () => void;
  onSaved: (p: Project) => void;
}) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? '');
  const [systemNote, setSystemNote] = useState(project.system_note ?? '');
  const [defaultModel, setDefaultModel] = useState(project.default_model ?? 'code');
  const [scopeText, setScopeText] = useState(
    Array.isArray(project.retrieval_scope)
      ? project.retrieval_scope.join('\n')
      : project.retrieval_scope
        ? String(project.retrieval_scope)
        : '',
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(project.name);
    setDescription(project.description ?? '');
    setSystemNote(project.system_note ?? '');
    setDefaultModel(project.default_model ?? 'code');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.Id]);

  // ESC closes the drawer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function save() {
    setSaving(true);
    try {
      const r = await patchProject(project.Id, {
        name,
        description,
        system_note: systemNote,
        default_model: defaultModel,
        retrieval_scope: scopeText
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
      });
      onSaved(r.project);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-fg/20 backdrop-blur-sm animate-fadeIn"
        onClick={onClose}
        aria-hidden
      />
      <aside className="fixed inset-y-0 right-0 z-50 w-[26rem] overflow-auto border-l border-border bg-bg shadow-hover animate-fadeIn">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-bg/95 px-5 py-3 backdrop-blur">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted font-sans">Settings</p>
            <h2 className="font-display text-xl tracking-tightest leading-none">{project.name}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-[11px] uppercase tracking-[0.16em] text-muted font-sans hover:text-fg"
            title="ESC to close"
          >
            Close
          </button>
        </header>

        <div className="p-5 space-y-4">
          <Field label="Name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm font-sans focus:outline-none focus:border-fg"
            />
          </Field>
          <Field label="Description">
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm font-sans focus:outline-none focus:border-fg"
            />
          </Field>
          <Field label="Default model">
            <input
              value={defaultModel}
              onChange={(e) => setDefaultModel(e.target.value)}
              className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm font-mono focus:outline-none focus:border-fg"
            />
          </Field>
          <Field label="System note" hint="Always prepended to agent prompts on this project.">
            <textarea
              rows={5}
              value={systemNote}
              onChange={(e) => setSystemNote(e.target.value)}
              className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm font-sans focus:outline-none focus:border-fg"
            />
          </Field>
          <Field
            label="Retrieval collections"
            hint="One Chroma collection per line. RAG queries will hit these in order."
          >
            <textarea
              rows={3}
              value={scopeText}
              onChange={(e) => setScopeText(e.target.value)}
              className="w-full rounded-md border border-border bg-bg px-3 py-2 text-xs font-mono focus:outline-none focus:border-fg"
            />
          </Field>
        </div>

        <footer className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-border bg-bg/95 px-5 py-3 backdrop-blur">
          <Btn variant="ghost" size="sm" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" size="sm" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </Btn>
        </footer>
      </aside>
    </>
  );
}

function Field({
  label, hint, children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-[0.16em] text-muted mb-1.5 font-sans">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-muted leading-snug">{hint}</span>}
    </label>
  );
}
