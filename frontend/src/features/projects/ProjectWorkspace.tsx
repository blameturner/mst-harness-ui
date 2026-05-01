import { useEffect, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { getProject, listProjectFiles } from '../../api/projects/projects';
import type { Project, ProjectFile } from '../../api/projects/types';
import { Btn } from '../../components/ui/Btn';
import { FileTree } from './components/FileTree';
import { FileViewer } from './components/FileViewer';
import { ProjectChat } from './components/ProjectChat';
import { SettingsDrawer } from './components/SettingsDrawer';
import { SidePanel } from './components/SidePanel';
import type { PendingPrompt } from './quickFix';

const PULSE_MS = 30_000;

export function ProjectWorkspace({ projectId }: { projectId: number }) {
  const [project, setProject] = useState<Project | null>(null);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [selected, setSelected] = useState<string | undefined>(undefined);
  const [showSettings, setShowSettings] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState<PendingPrompt | null>(null);
  const [pulsing, setPulsing] = useState<Set<string>>(new Set());
  const pulseTimers = useRef<Record<string, number>>({});

  async function refreshProject() {
    const r = await getProject(projectId);
    setProject(r.project);
  }
  async function refreshFiles() {
    const r = await listProjectFiles(projectId);
    setFiles(r.files ?? []);
  }

  useEffect(() => {
    refreshProject();
    refreshFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  function pulse(path: string) {
    setPulsing((prev) => new Set(prev).add(path));
    if (pulseTimers.current[path]) window.clearTimeout(pulseTimers.current[path]);
    pulseTimers.current[path] = window.setTimeout(() => {
      setPulsing((prev) => {
        const n = new Set(prev);
        n.delete(path);
        return n;
      });
    }, PULSE_MS);
  }

  function onFileChange(path: string) {
    pulse(path);
    refreshFiles();
  }

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted">Loading project…</div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-bg text-fg">
      <header className="shrink-0 flex items-center gap-4 border-b border-border bg-bg/95 px-5 py-3 backdrop-blur">
        <Link
          to="/projects"
          className="text-[10px] uppercase tracking-[0.18em] text-muted font-sans hover:text-fg transition-colors"
        >
          ← Projects
        </Link>
        <div className="flex items-baseline gap-2 min-w-0">
          <h1 className="font-display text-xl font-semibold tracking-tightest leading-none truncate">
            {project.name}
          </h1>
          <span className="text-[10px] uppercase tracking-[0.16em] text-muted font-mono truncate">
            {project.slug}
          </span>
        </div>
        {project.gitea_origin && (
          <span
            title={project.gitea_origin}
            className="rounded-sm border border-border bg-panel px-1.5 py-0.5 text-[9px] uppercase tracking-[0.18em] text-muted font-sans"
          >
            Gitea · {project.gitea_origin}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Btn variant="ghost" size="sm" onClick={() => setShowSettings(true)}>
            Settings
          </Btn>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-60 shrink-0 border-r border-border bg-panel/50">
          <FileTree
            files={files}
            selected={selected}
            onSelect={setSelected}
            recentlyChanged={pulsing}
          />
        </aside>
        <main className="flex-1 overflow-hidden border-r border-border">
          {selected ? (
            <FileViewer
              projectId={projectId}
              path={selected}
              onClose={() => setSelected(undefined)}
              onChanged={refreshFiles}
            />
          ) : (
            <EmptyViewer fileCount={files.length} />
          )}
        </main>
        <section className="w-[26rem] shrink-0 border-r border-border bg-panel/30">
          <ProjectChat
            projectId={projectId}
            onFileChange={onFileChange}
            pendingPrompt={pendingPrompt}
            onPromptConsumed={() => setPendingPrompt(null)}
          />
        </section>
        <section className="w-80 shrink-0 bg-panel/50">
          <SidePanel projectId={projectId} requestQuickFix={setPendingPrompt} />
        </section>
      </div>

      {showSettings && (
        <SettingsDrawer
          project={project}
          onClose={() => setShowSettings(false)}
          onSaved={(p) => setProject(p)}
        />
      )}
    </div>
  );
}

function EmptyViewer({ fileCount }: { fileCount: number }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-8 text-center">
      <p className="text-[10px] uppercase tracking-[0.18em] text-muted font-sans">
        {fileCount === 0 ? 'Empty project' : 'No file selected'}
      </p>
      <p className="mt-3 font-display text-2xl tracking-tightest">
        {fileCount === 0 ? 'No files yet' : 'Pick a file to view'}
      </p>
      <p className="mt-2 text-sm text-muted max-w-sm">
        {fileCount === 0
          ? 'Send the agent a message in apply mode and it will write the first file.'
          : 'Files appear in the tree on the left. Double-click to edit.'}
      </p>
    </div>
  );
}
