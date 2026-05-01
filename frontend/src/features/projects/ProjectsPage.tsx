import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { archiveProject, createProject, listProjects } from '../../api/projects/projects';
import type { Project } from '../../api/projects/types';
import { Btn } from '../../components/ui/Btn';

export function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  async function refresh() {
    setLoading(true);
    try {
      const r = await listProjects(showArchived);
      setProjects(r.projects ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showArchived]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await createProject({ name: name.trim(), description });
    setName('');
    setDescription('');
    setCreating(false);
    refresh();
  }

  async function onArchive(id: number) {
    if (!confirm('Archive this project?')) return;
    await archiveProject(id);
    refresh();
  }

  return (
    <div className="mx-auto h-full max-w-5xl overflow-y-auto px-6 py-10 animate-fadeIn">
      <header className="mb-8 flex items-end justify-between gap-6 border-b border-border pb-6">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted font-sans">Workspace</p>
          <h1 className="mt-1 font-display text-4xl font-semibold tracking-tightest leading-none">
            Projects<span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-fg align-middle" />
          </h1>
          <p className="mt-2 text-sm text-muted max-w-xl">
            A project is a stable context plus a versioned virtual filesystem — pin files,
            scope chat, and let the agent write code that lands as new file versions.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-muted font-sans cursor-pointer">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="accent-fg"
            />
            Show archived
          </label>
          <Btn variant="primary" onClick={() => setCreating((v) => !v)}>
            {creating ? 'Cancel' : 'New project'}
          </Btn>
        </div>
      </header>

      {creating && (
        <form
          onSubmit={onCreate}
          className="mb-8 rounded-md border border-border bg-panel p-5 shadow-card animate-fadeIn"
        >
          <p className="mb-4 text-[10px] uppercase tracking-[0.18em] text-muted font-sans">New project</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="sm:col-span-1 block">
              <span className="block text-[10px] uppercase tracking-[0.16em] text-muted mb-1.5 font-sans">
                Name
              </span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                placeholder="marketing-site"
                className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm font-sans focus:outline-none focus:border-fg"
              />
            </label>
            <label className="sm:col-span-2 block">
              <span className="block text-[10px] uppercase tracking-[0.16em] text-muted mb-1.5 font-sans">
                Description
              </span>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional"
                className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm font-sans focus:outline-none focus:border-fg"
              />
            </label>
          </div>
          <div className="mt-4 flex gap-2">
            <Btn type="submit" variant="primary">Create</Btn>
            <Btn type="button" variant="ghost" onClick={() => setCreating(false)}>Cancel</Btn>
          </div>
        </form>
      )}

      {loading ? (
        <div className="py-16 text-center text-sm text-muted">Loading…</div>
      ) : projects.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-panel/50 px-6 py-16 text-center">
          <p className="font-display text-2xl tracking-tightest">No projects yet</p>
          <p className="mt-2 text-sm text-muted">
            {showArchived ? 'No archived projects.' : 'Create one above to get started.'}
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {projects.map((p) => (
            <li key={p.Id}>
              <article className="group relative h-full rounded-md border border-border bg-panel transition-shadow hover:shadow-hover">
                <Link
                  to="/projects/$id"
                  params={{ id: String(p.Id) }}
                  className="block p-5"
                >
                  <header className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="font-display text-xl font-semibold tracking-tightest leading-tight">
                        {p.name}
                      </h2>
                      <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-muted font-mono truncate">
                        {p.slug}
                      </p>
                    </div>
                    {p.gitea_origin && (
                      <span
                        title={p.gitea_origin}
                        className="shrink-0 rounded-sm border border-border bg-bg px-1.5 py-0.5 text-[9px] uppercase tracking-[0.18em] text-muted font-sans"
                      >
                        Gitea
                      </span>
                    )}
                  </header>
                  {p.description && (
                    <p className="mt-3 text-sm text-fg/80 line-clamp-2">{p.description}</p>
                  )}
                </Link>
                {!p.archived_at && (
                  <button
                    onClick={() => onArchive(p.Id)}
                    className="absolute right-3 bottom-3 text-[10px] uppercase tracking-[0.16em] font-sans text-muted opacity-0 transition-opacity hover:text-fg group-hover:opacity-100"
                  >
                    Archive
                  </button>
                )}
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
