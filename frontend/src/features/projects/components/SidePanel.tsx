import { useEffect, useState } from 'react';
import {
  aiFaqAppend, aiGeneratePlaybook, aiRegenerateReadme, aiReview, aiSmartPaste,
  complexity, createGiteaRepoForProject, createSnapshot, deleteGiteaConnection,
  dependencies, docCoverage, getGiteaConnection, giteaPullApply, giteaPullPreview,
  giteaStatus, importGraph, listGiteaOrgs, listIssues, listSnapshots, openWork,
  projectFeed, projectMetrics, pushToGitea, runLint, snapshotDiff, testDiscovery,
  testGiteaConnection, upsertGiteaConnection,
} from '../../../api/projects/projects';
import type { ReviewResult } from '../../../api/projects/projects';
import type { GiteaStatus, LintIssue, ProjectAuditEvent, ProjectSnapshot } from '../../../api/projects/types';
import { Btn } from '../../../components/ui/Btn';
import { buildLintQuickFixPrompt, type PendingPrompt } from '../quickFix';

type Tab = 'open' | 'issues' | 'snapshots' | 'gitea' | 'metrics' | 'audit' | 'analysis' | 'ai';

const TABS: { id: Tab; label: string }[] = [
  { id: 'open', label: 'Open' },
  { id: 'issues', label: 'Issues' },
  { id: 'snapshots', label: 'Snapshots' },
  { id: 'gitea', label: 'Gitea' },
  { id: 'metrics', label: 'Metrics' },
  { id: 'audit', label: 'Audit' },
  { id: 'analysis', label: 'Analysis' },
  { id: 'ai', label: 'AI' },
];

interface QuickFixCtx {
  requestQuickFix?: (prompt: PendingPrompt) => void;
}

export function SidePanel({
  projectId, requestQuickFix,
}: { projectId: number } & QuickFixCtx) {
  const [tab, setTab] = useState<Tab>('open');
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <nav className="flex flex-wrap gap-0.5 border-b border-border px-2 py-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={[
              'rounded-sm px-2 py-1 text-[10px] uppercase tracking-[0.16em] font-sans transition-colors',
              t.id === tab ? 'bg-fg text-bg' : 'text-muted hover:text-fg hover:bg-panelHi',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </nav>
      <div className="flex-1 overflow-auto px-3 py-3 text-xs animate-fadeIn">
        {tab === 'open' && <OpenWorkPanel projectId={projectId} />}
        {tab === 'issues' && <IssuesPanel projectId={projectId} requestQuickFix={requestQuickFix} />}
        {tab === 'snapshots' && <SnapshotsPanel projectId={projectId} />}
        {tab === 'gitea' && <GiteaPanel projectId={projectId} />}
        {tab === 'metrics' && <MetricsPanel projectId={projectId} />}
        {tab === 'audit' && <AuditPanel projectId={projectId} />}
        {tab === 'analysis' && <AnalysisPanel projectId={projectId} />}
        {tab === 'ai' && <AIPanel projectId={projectId} />}
      </div>
    </div>
  );
}

// ---------- shared primitives ----------
function Caption({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] uppercase tracking-[0.18em] text-muted font-sans">{children}</p>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-border py-1.5 last:border-b-0">
      <span className="text-[10px] uppercase tracking-[0.16em] text-muted font-sans">{label}</span>
      <span className="font-mono text-sm text-fg">{value}</span>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-md border border-border bg-bg p-3">{children}</div>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 py-8 text-center text-[11px] uppercase tracking-[0.18em] text-muted font-sans">
      {children}
    </p>
  );
}

// ---------- panels ----------
function OpenWorkPanel({ projectId }: { projectId: number }) {
  const [data, setData] = useState<{
    open_todos: number;
    permission_requests: { path: string; reason: string }[];
    file_count: number;
  } | null>(null);
  useEffect(() => {
    openWork(projectId).then(setData);
  }, [projectId]);
  if (!data) return <Empty>Loading…</Empty>;
  return (
    <div className="space-y-3">
      <Card>
        <Stat label="Files" value={data.file_count} />
        <Stat label="Open TODOs" value={data.open_todos} />
        <Stat label="Permission requests" value={data.permission_requests.length} />
      </Card>
      {data.permission_requests.length > 0 && (
        <div>
          <Caption>Permission requests</Caption>
          <ul className="mt-2 space-y-1">
            {data.permission_requests.map((p, i) => (
              <li key={i} className="rounded-sm border border-border bg-panel p-2">
                <p className="font-mono text-[11px] text-fg">{p.path}</p>
                <p className="mt-0.5 text-[11px] text-muted">{p.reason}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function IssuesPanel({ projectId, requestQuickFix }: { projectId: number } & QuickFixCtx) {
  const [issues, setIssues] = useState<(LintIssue & { path?: string })[]>([]);
  const [running, setRunning] = useState(false);

  async function load() {
    const r = await listIssues(projectId);
    setIssues((r.issues ?? []).map((i) => ({ ...i })));
  }
  async function rerun() {
    setRunning(true);
    try {
      const r = await runLint(projectId);
      const flat: (LintIssue & { path: string })[] = [];
      for (const f of r.files ?? []) {
        for (const issue of f.issues ?? []) flat.push({ ...issue, path: f.path });
      }
      setIssues(flat);
    } finally {
      setRunning(false);
    }
  }
  useEffect(() => {
    load();
  }, [projectId]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Caption>{issues.length} issue{issues.length === 1 ? '' : 's'}</Caption>
        <Btn variant="secondary" size="sm" disabled={running} onClick={rerun}>
          {running ? 'Running…' : 'Run lint'}
        </Btn>
      </div>
      {issues.length === 0 ? (
        <Empty>No issues recorded. Run lint to populate.</Empty>
      ) : (
        <ul className="space-y-1.5">
          {issues.map((i, k) => {
            const canQuickFix = !!requestQuickFix && !!i.path && i.severity !== 'info';
            return (
              <li key={k} className="rounded-sm border border-border bg-bg p-2">
                <div className="flex items-start gap-2">
                  <SeverityBadge severity={i.severity} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-mono text-[11px] text-fg">{i.rule}</span>
                      {i.path && (
                        <span className="font-mono text-[10px] text-muted truncate">{i.path}</span>
                      )}
                      {i.line && <span className="text-[10px] text-muted">L{i.line}</span>}
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted leading-snug">{i.message}</p>
                  </div>
                  {canQuickFix && (
                    <button
                      title="Quick fix — pre-fills the chat with an apply prompt scoped to this file"
                      onClick={() =>
                        requestQuickFix!(buildLintQuickFixPrompt(i.path!, i.line, i.rule, i.message))
                      }
                      className="shrink-0 rounded-sm border border-border bg-panel px-1.5 py-0.5 text-[10px] uppercase tracking-[0.16em] text-muted font-sans hover:border-fg hover:text-fg"
                    >
                      Fix
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, string> = {
    error: 'border-red-300 bg-red-50 text-red-700',
    security: 'border-purple-300 bg-purple-50 text-purple-700',
    warning: 'border-amber-300 bg-amber-50 text-amber-800',
    info: 'border-border bg-panel text-muted',
  };
  return (
    <span
      className={`shrink-0 rounded-sm border px-1.5 py-0.5 text-[9px] uppercase tracking-[0.18em] font-sans ${map[severity] ?? map.info}`}
    >
      {severity}
    </span>
  );
}

function SnapshotsPanel({ projectId }: { projectId: number }) {
  const [snaps, setSnaps] = useState<ProjectSnapshot[]>([]);
  const [label, setLabel] = useState('');
  const [diffLabel, setDiffLabel] = useState<string | null>(null);
  const [diff, setDiff] = useState<{ path: string; state: string; unified: string }[]>([]);

  async function load() {
    const r = await listSnapshots(projectId);
    setSnaps(r.snapshots ?? []);
  }
  useEffect(() => {
    load();
  }, [projectId]);

  async function viewDiff(l: string) {
    setDiffLabel(l);
    const r = await snapshotDiff(projectId, l);
    setDiff(r.files ?? []);
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="label e.g. v1"
          className="flex-1 rounded-sm border border-border bg-bg px-2 py-1 text-xs font-sans focus:outline-none focus:border-fg"
        />
        <Btn
          variant="primary"
          size="sm"
          disabled={!label}
          onClick={async () => {
            if (label) {
              await createSnapshot(projectId, label);
              setLabel('');
              load();
            }
          }}
        >
          Snap
        </Btn>
      </div>
      {snaps.length === 0 ? (
        <Empty>No snapshots yet.</Empty>
      ) : (
        <ul className="space-y-1">
          {snaps.map((s) => (
            <li key={s.Id} className="flex items-center justify-between rounded-sm border border-border bg-bg px-2 py-1.5">
              <div>
                <span className="font-mono text-[11px] text-fg">{s.label}</span>
                <span className="ml-2 text-[10px] uppercase tracking-[0.16em] text-muted font-sans">
                  {s.file_count ?? 0} files
                </span>
              </div>
              <button
                onClick={() => viewDiff(s.label)}
                className="text-[10px] uppercase tracking-[0.16em] font-sans text-muted hover:text-fg"
              >
                Diff
              </button>
            </li>
          ))}
        </ul>
      )}
      {diffLabel && (
        <div className="space-y-1">
          <Caption>Diff vs current — {diffLabel}</Caption>
          {diff.length === 0 ? (
            <Empty>Identical.</Empty>
          ) : (
            diff.map((d, i) => (
              <details key={i} className="rounded-sm border border-border bg-bg">
                <summary className="cursor-pointer px-2 py-1 text-[11px]">
                  <span className="text-muted">[{d.state}]</span>{' '}
                  <span className="font-mono">{d.path}</span>
                </summary>
                <pre className="overflow-x-auto border-t border-border bg-panel p-2 text-[10px] font-mono">
                  {d.unified}
                </pre>
              </details>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function GiteaPanel({ projectId }: { projectId: number }) {
  const [conn, setConn] = useState<{ base_url?: string; username?: string; verified_at?: string } | null | undefined>(undefined);
  const [s, setS] = useState<GiteaStatus | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function loadAll() {
    try {
      const c = await getGiteaConnection();
      setConn(c.connection);
    } catch {
      setConn(null);
    }
    try {
      setS(await giteaStatus(projectId));
    } catch {
      setS({ linked: false });
    }
  }
  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function onTest() {
    setBusy('test');
    setMsg(null);
    try {
      const r = await testGiteaConnection();
      setMsg(r.ok ? `Verified as ${r.login} (Gitea ${r.server_version})` : `Failed: ${r.error}`);
    } finally {
      setBusy(null);
    }
  }

  async function onDisconnect() {
    if (!confirm('Disconnect from Gitea? Stored token will be cleared.')) return;
    setBusy('disconnect');
    try {
      await deleteGiteaConnection();
      setConn(null);
    } finally {
      setBusy(null);
    }
  }

  async function onPush(force: boolean) {
    const message = prompt('Commit message:', 'Update from Jeff');
    if (!message) return;
    setBusy('push');
    setMsg(null);
    try {
      const r = await pushToGitea(projectId, { message, force });
      if (r.detail?.reason === 'remote_diverged') {
        setMsg(`Remote diverged (${r.detail.behind_count} commits ahead). Pull first or use force.`);
      } else {
        const parts = [`Pushed ${r.pushed ?? 0}`];
        if (r.skipped) parts.push(`${r.skipped} unchanged`);
        if (r.failures?.length) parts.push(`${r.failures.length} failed`);
        setMsg(parts.join(' · ') + '.');
        loadAll();
      }
    } finally {
      setBusy(null);
    }
  }

  if (conn === undefined) return <Empty>Loading…</Empty>;
  if (!conn || !conn.base_url) {
    return showSetup ? (
      <GiteaConnectionForm onDone={() => { setShowSetup(false); loadAll(); }} onCancel={() => setShowSetup(false)} />
    ) : (
      <div className="space-y-3">
        <Card>
          <Caption>Connection</Caption>
          <p className="mt-2 text-[11px] text-muted leading-snug">
            No Gitea connection configured for this org. Set one up to push and pull project snapshots.
          </p>
          <div className="mt-3">
            <Btn variant="primary" size="sm" onClick={() => setShowSetup(true)}>Set up Gitea</Btn>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Caption>Connection</Caption>
            <p className="mt-1 truncate font-mono text-[11px] text-fg">{conn.base_url}</p>
            <p className="mt-0.5 text-[11px] text-muted">
              <span className="font-mono">{conn.username}</span>
              {conn.verified_at && (
                <span className="ml-2 text-[10px] uppercase tracking-[0.16em] text-emerald-700">verified</span>
              )}
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-1">
            <Btn variant="ghost" size="sm" onClick={onTest} disabled={busy === 'test'}>{busy === 'test' ? '…' : 'Test'}</Btn>
            <Btn variant="ghost" size="sm" onClick={() => setShowSetup(true)}>Edit</Btn>
            <Btn variant="danger" size="sm" onClick={onDisconnect} disabled={busy === 'disconnect'}>Disconnect</Btn>
          </div>
        </div>
      </Card>

      {showSetup && (
        <GiteaConnectionForm onDone={() => { setShowSetup(false); loadAll(); }} onCancel={() => setShowSetup(false)} />
      )}

      {!s?.linked ? (
        <Card>
          <Caption>This project</Caption>
          <p className="mt-2 text-[11px] text-muted leading-snug">
            Not linked to a Gitea repo yet.
          </p>
          <div className="mt-3">
            <Btn variant="primary" size="sm" onClick={() => setShowCreate(true)}>Create repo from project</Btn>
          </div>
          {showCreate && (
            <div className="mt-3">
              <GiteaCreateRepoForm
                projectId={projectId}
                onDone={() => { setShowCreate(false); loadAll(); }}
                onCancel={() => setShowCreate(false)}
              />
            </div>
          )}
        </Card>
      ) : (
        <Card>
          <Caption>Sync</Caption>
          <p className="mt-1 truncate font-mono text-[11px] text-fg">{s.origin}</p>
          <div className="mt-2 flex items-center gap-3">
            <StateBadge state={s.state} />
            <span className="text-[11px] text-muted font-mono">↑ {s.ahead?.length ?? 0}</span>
            <span className="text-[11px] text-muted font-mono">↓ {s.behind_count ?? 0}</span>
          </div>
          {s.ahead && s.ahead.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-[10px] uppercase tracking-[0.16em] text-muted font-sans">
                Ahead files
              </summary>
              <ul className="mt-1 ml-3 space-y-0.5">
                {s.ahead.map((p, i) => (
                  <li key={i} className="font-mono text-[11px] text-fg">{p}</li>
                ))}
              </ul>
            </details>
          )}
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Btn variant="primary" size="sm" disabled={busy === 'push' || !s.ahead?.length} onClick={() => onPush(false)}>
              {busy === 'push' ? 'Pushing…' : 'Push'}
            </Btn>
            <Btn variant="danger" size="sm" disabled={busy === 'push'} onClick={() => onPush(true)}>
              Force push
            </Btn>
            <PullDrawer projectId={projectId} onApplied={loadAll} />
          </div>
        </Card>
      )}

      {msg && <p className="text-[11px] text-fg leading-snug animate-fadeIn">{msg}</p>}
    </div>
  );
}

function StateBadge({ state }: { state?: string }) {
  const map: Record<string, string> = {
    in_sync: 'border-emerald-300 bg-emerald-50 text-emerald-700',
    ahead: 'border-amber-300 bg-amber-50 text-amber-800',
    behind: 'border-amber-300 bg-amber-50 text-amber-800',
    diverged: 'border-red-300 bg-red-50 text-red-700',
    unlinked: 'border-border bg-panel text-muted',
  };
  const cls = state ? map[state] ?? map.unlinked : map.unlinked;
  return (
    <span className={`rounded-sm border px-1.5 py-0.5 text-[9px] uppercase tracking-[0.18em] font-sans ${cls}`}>
      {state ?? 'unknown'}
    </span>
  );
}

function GiteaConnectionForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [baseUrl, setBaseUrl] = useState('http://gitea:3000');
  const [username, setUsername] = useState('');
  const [token, setToken] = useState('');
  const [defaultBranch, setDefaultBranch] = useState('main');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setErr(null);
    setBusy(true);
    try {
      const r = await upsertGiteaConnection({ base_url: baseUrl, username, access_token: token, default_branch: defaultBranch });
      if (r.verified_as) onDone();
      else setErr('Verification returned no login.');
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <Caption>Gitea connection</Caption>
      <p className="mt-1 mb-3 text-[10px] text-muted">
        For Docker Compose, base URL is typically <code className="font-mono">http://gitea:3000</code>.
      </p>
      <div className="space-y-2">
        <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="Base URL"
          className="w-full rounded-sm border border-border bg-bg px-2 py-1 text-xs font-mono focus:outline-none focus:border-fg" />
        <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username"
          className="w-full rounded-sm border border-border bg-bg px-2 py-1 text-xs font-mono focus:outline-none focus:border-fg" />
        <input value={token} onChange={(e) => setToken(e.target.value)} type="password" placeholder="Personal Access Token (repo scope)"
          className="w-full rounded-sm border border-border bg-bg px-2 py-1 text-xs font-mono focus:outline-none focus:border-fg" />
        <input value={defaultBranch} onChange={(e) => setDefaultBranch(e.target.value)} placeholder="Default branch"
          className="w-full rounded-sm border border-border bg-bg px-2 py-1 text-xs font-mono focus:outline-none focus:border-fg" />
      </div>
      <div className="mt-3 flex gap-1.5">
        <Btn variant="primary" size="sm" onClick={save} disabled={busy || !baseUrl || !username || !token}>
          {busy ? 'Verifying…' : 'Save & verify'}
        </Btn>
        <Btn variant="ghost" size="sm" onClick={onCancel}>Cancel</Btn>
      </div>
      {err && <p className="mt-2 text-[11px] text-red-700">{err}</p>}
    </Card>
  );
}

function GiteaCreateRepoForm({
  projectId, onDone, onCancel,
}: {
  projectId: number;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [orgs, setOrgs] = useState<{ username: string }[]>([]);
  const [owner, setOwner] = useState('');
  const [ownerKind, setOwnerKind] = useState<'user' | 'org'>('user');
  const [repo, setRepo] = useState('');
  const [isPrivate, setIsPrivate] = useState(true);
  const [defaultBranch, setDefaultBranch] = useState('main');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const me = await getGiteaConnection();
        if (me.connection?.username) setOwner(me.connection.username);
        const o = await listGiteaOrgs();
        setOrgs(o.orgs ?? []);
      } catch {
        // ignore
      }
    })();
  }, []);

  async function go() {
    setErr(null);
    setBusy(true);
    try {
      const r = await createGiteaRepoForProject(projectId, {
        owner, owner_kind: ownerKind, repo,
        private: isPrivate, default_branch: defaultBranch, init_readme: false,
      });
      if (r.repo) onDone();
      else setErr('Create returned no repo.');
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <Caption>New Gitea repo</Caption>
      <div className="mt-2 space-y-2">
        <div className="flex gap-1.5">
          <select
            value={ownerKind}
            onChange={(e) => setOwnerKind(e.target.value as 'user' | 'org')}
            className="rounded-sm border border-border bg-bg px-2 py-1 text-xs font-sans focus:outline-none focus:border-fg"
          >
            <option value="user">user</option>
            <option value="org">org</option>
          </select>
          <input
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            placeholder="owner"
            list="gitea-owners"
            className="flex-1 rounded-sm border border-border bg-bg px-2 py-1 text-xs font-mono focus:outline-none focus:border-fg"
          />
          <datalist id="gitea-owners">
            {orgs.map((o) => <option key={o.username} value={o.username} />)}
          </datalist>
        </div>
        <input
          value={repo}
          onChange={(e) => setRepo(e.target.value)}
          placeholder="repo name"
          className="w-full rounded-sm border border-border bg-bg px-2 py-1 text-xs font-mono focus:outline-none focus:border-fg"
        />
        <input
          value={defaultBranch}
          onChange={(e) => setDefaultBranch(e.target.value)}
          placeholder="default branch"
          className="w-full rounded-sm border border-border bg-bg px-2 py-1 text-xs font-mono focus:outline-none focus:border-fg"
        />
        <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-muted font-sans cursor-pointer">
          <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} className="accent-fg" />
          private
        </label>
      </div>
      <div className="mt-3 flex gap-1.5">
        <Btn variant="primary" size="sm" onClick={go} disabled={busy || !owner || !repo}>
          {busy ? 'Creating…' : 'Create + initial push'}
        </Btn>
        <Btn variant="ghost" size="sm" onClick={onCancel}>Cancel</Btn>
      </div>
      {err && <p className="mt-2 text-[11px] text-red-700">{err}</p>}
    </Card>
  );
}

function PullDrawer({ projectId, onApplied }: { projectId: number; onApplied: () => void }) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<{ remote_head_sha: string; files: { path: string; state: string; diff: string | null }[] } | null>(null);
  const [decisions, setDecisions] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    setBusy(true);
    setMsg(null);
    try {
      setPreview(await giteaPullPreview(projectId));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    if (!preview) return;
    setBusy(true);
    try {
      const items = Object.entries(decisions).map(([path, choice]) => ({ path, choice }));
      const r = await giteaPullApply(projectId, items, preview.remote_head_sha);
      setMsg(`Applied ${r.applied.length} decisions.`);
      setOpen(false);
      onApplied();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Btn variant="secondary" size="sm" onClick={async () => { setOpen(true); if (!preview) await load(); }}>
        Pull…
      </Btn>
      {open && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-fg/30 backdrop-blur-sm p-6 animate-fadeIn"
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[80vh] w-[640px] overflow-auto rounded-md border border-border bg-bg shadow-hover"
          >
            <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-bg/95 px-4 py-3 backdrop-blur">
              <div>
                <Caption>Pull from Gitea</Caption>
                <h3 className="font-display text-lg tracking-tightest leading-none">Resolve changes</h3>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-[11px] uppercase tracking-[0.16em] text-muted font-sans hover:text-fg"
              >
                Close
              </button>
            </header>
            <div className="p-4">
              {!preview ? (
                <Empty>Loading preview…</Empty>
              ) : (
                <>
                  <p className="mb-3 text-[10px] uppercase tracking-[0.16em] text-muted font-sans">
                    Remote head <span className="font-mono lowercase tracking-normal">{preview.remote_head_sha?.slice(0, 8)}</span>
                  </p>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border text-left">
                        <th className="py-1.5 text-[10px] uppercase tracking-[0.16em] text-muted font-sans font-normal">Path</th>
                        <th className="py-1.5 text-[10px] uppercase tracking-[0.16em] text-muted font-sans font-normal">State</th>
                        <th className="py-1.5 text-[10px] uppercase tracking-[0.16em] text-muted font-sans font-normal">Decision</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.files.map((f) => (
                        <tr key={f.path} className="border-b border-border last:border-b-0">
                          <td className="py-1.5 font-mono">{f.path}</td>
                          <td><PullStateChip state={f.state} /></td>
                          <td>
                            {f.state === 'identical' ? (
                              <span className="text-muted">—</span>
                            ) : (
                              <select
                                value={decisions[f.path] || ''}
                                onChange={(e) => setDecisions((d) => ({ ...d, [f.path]: e.target.value }))}
                                className="rounded-sm border border-border bg-bg px-1.5 py-0.5 text-xs font-sans focus:outline-none focus:border-fg"
                              >
                                <option value="">(skip)</option>
                                <option value="ours">keep ours</option>
                                <option value="theirs">take theirs</option>
                                <option value="theirs_into_new_branch">theirs → branch</option>
                              </select>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="mt-4 flex items-center justify-between">
                    <Btn variant="ghost" size="sm" onClick={load} disabled={busy}>Refresh</Btn>
                    <Btn variant="primary" size="sm" onClick={apply} disabled={busy}>
                      {busy ? 'Applying…' : 'Apply'}
                    </Btn>
                  </div>
                  {msg && <p className="mt-2 text-[11px] text-muted">{msg}</p>}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function PullStateChip({ state }: { state: string }) {
  const map: Record<string, string> = {
    identical: 'text-muted',
    remote_only: 'text-blue-700',
    local_only: 'text-amber-700',
    both_modified: 'text-red-700',
  };
  return (
    <span className={`text-[10px] uppercase tracking-[0.16em] font-sans ${map[state] ?? 'text-muted'}`}>
      {state}
    </span>
  );
}

function MetricsPanel({ projectId }: { projectId: number }) {
  const [m, setM] = useState<Record<string, unknown> | null>(null);
  useEffect(() => {
    projectMetrics(projectId).then(setM);
  }, [projectId]);
  if (!m) return <Empty>Loading…</Empty>;
  return (
    <Card>
      {Object.entries(m).map(([k, v]) => (
        <Stat key={k} label={k} value={typeof v === 'object' ? JSON.stringify(v) : String(v)} />
      ))}
    </Card>
  );
}

function AuditPanel({ projectId }: { projectId: number }) {
  const [events, setEvents] = useState<ProjectAuditEvent[]>([]);
  useEffect(() => {
    projectFeed(projectId, 168).then((r) => setEvents(r.events ?? []));
  }, [projectId]);
  if (events.length === 0) return <Empty>No recent activity.</Empty>;
  return (
    <ol className="space-y-2">
      {events.map((e, i) => (
        <li key={i} className="border-l-2 border-border pl-3">
          <p className="text-[10px] uppercase tracking-[0.16em] text-muted font-sans">{e.CreatedAt}</p>
          <p className="text-[11px]">
            <span className="font-mono text-fg">{e.kind}</span>
            <span className="mx-1.5 text-muted">·</span>
            <span className="text-muted">{e.actor}</span>
          </p>
          {e.payload && Object.keys(e.payload).length > 0 && (
            <p className="mt-0.5 truncate text-[10px] text-muted font-mono">{JSON.stringify(e.payload)}</p>
          )}
        </li>
      ))}
    </ol>
  );
}

function AnalysisPanel({ projectId }: { projectId: number }) {
  const [tab, setTab] = useState<'symbols' | 'graph' | 'complexity' | 'docs' | 'tests' | 'deps'>('symbols');
  const tools = ['symbols', 'graph', 'complexity', 'docs', 'tests', 'deps'] as const;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1">
        {tools.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={[
              'rounded-sm px-1.5 py-0.5 text-[10px] uppercase tracking-[0.16em] font-sans transition-colors',
              t === tab ? 'bg-fg text-bg' : 'text-muted hover:text-fg hover:bg-panelHi',
            ].join(' ')}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === 'complexity' && (
        <Lazy
          fn={() => complexity(projectId).then((r) => r.files)}
          render={(rows) => (
            <ul className="space-y-1">
              {rows.map((r, i) => (
                <li
                  key={i}
                  className={`flex items-baseline justify-between rounded-sm border border-border bg-bg px-2 py-1 ${
                    r.over_threshold ? 'border-red-300' : ''
                  }`}
                >
                  <span className="font-mono text-[11px] truncate">{r.path}</span>
                  <span className={`font-mono text-[11px] ${r.over_threshold ? 'text-red-700 font-semibold' : 'text-muted'}`}>
                    {r.complexity}
                  </span>
                </li>
              ))}
            </ul>
          )}
        />
      )}
      {tab === 'docs' && (
        <Lazy
          fn={() => docCoverage(projectId)}
          render={(d) => (
            <Card>
              <Stat label="Overall coverage" value={`${(d.overall_coverage * 100).toFixed(0)}%`} />
              <Stat label="Documented" value={d.documented} />
              <Stat label="Total symbols" value={d.total_symbols} />
            </Card>
          )}
        />
      )}
      {tab === 'tests' && (
        <Lazy
          fn={() => testDiscovery(projectId)}
          render={(t) => (
            <Card>
              <Stat label="Test files" value={t.test_files} />
              <Stat label="Total tests" value={t.total_tests} />
            </Card>
          )}
        />
      )}
      {tab === 'deps' && (
        <Lazy
          fn={() => dependencies(projectId)}
          render={(d) => (
            d.dependencies.length === 0 ? <Empty>No dependencies detected.</Empty> :
            <ul className="space-y-0.5">
              {d.dependencies.map((x, i) => (
                <li key={i} className="flex items-baseline gap-2 rounded-sm border border-border bg-bg px-2 py-1">
                  <span className="font-mono text-[11px] flex-1 truncate">{x.name}</span>
                  <span className="font-mono text-[11px] text-muted">{x.version}</span>
                  <span className="text-[9px] uppercase tracking-[0.16em] text-muted font-sans">{x.manager}</span>
                </li>
              ))}
            </ul>
          )}
        />
      )}
      {tab === 'symbols' && (
        <Lazy
          fn={() => importGraph(projectId)}
          render={(g) => (
            <Card>
              <Stat label="Files" value={g.elements.nodes.length} />
              <Stat label="Import edges" value={g.elements.edges.length} />
            </Card>
          )}
        />
      )}
      {tab === 'graph' && (
        <Lazy
          fn={() => importGraph(projectId)}
          render={(g) => (
            <pre className="overflow-x-auto rounded-md border border-border bg-panel p-2 font-mono text-[10px] leading-snug">
              {JSON.stringify(g.elements, null, 2)}
            </pre>
          )}
        />
      )}
    </div>
  );
}

function Lazy<T>({ fn, render }: { fn: () => Promise<T>; render: (v: T) => React.ReactNode }) {
  const [v, setV] = useState<T | null>(null);
  useEffect(() => {
    fn().then(setV).catch(() => setV(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (v == null) return <Empty>Loading…</Empty>;
  return <>{render(v)}</>;
}

// ---------- AI sub-tools ----------
function AIPanel({ projectId }: { projectId: number }) {
  const [tool, setTool] = useState<'review' | 'readme' | 'paste' | 'faq' | 'playbook'>('review');
  const tools = ['review', 'readme', 'paste', 'faq', 'playbook'] as const;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1">
        {tools.map((t) => (
          <button
            key={t}
            onClick={() => setTool(t)}
            className={[
              'rounded-sm px-1.5 py-0.5 text-[10px] uppercase tracking-[0.16em] font-sans transition-colors',
              t === tool ? 'bg-fg text-bg' : 'text-muted hover:text-fg hover:bg-panelHi',
            ].join(' ')}
          >
            {t}
          </button>
        ))}
      </div>
      {tool === 'review' && <ReviewTool projectId={projectId} />}
      {tool === 'readme' && <ReadmeTool projectId={projectId} />}
      {tool === 'paste' && <PasteTool projectId={projectId} />}
      {tool === 'faq' && <FaqTool projectId={projectId} />}
      {tool === 'playbook' && <PlaybookTool projectId={projectId} />}
    </div>
  );
}

function ReviewTool({ projectId }: { projectId: number }) {
  const [snapshot, setSnapshot] = useState('');
  const [convId, setConvId] = useState('');
  const [busy, setBusy] = useState(false);
  const [r, setR] = useState<ReviewResult | null>(null);

  async function go() {
    setBusy(true);
    setR(null);
    try {
      const body: { from_snapshot?: string; conversation_id?: number } = {};
      if (snapshot) body.from_snapshot = snapshot;
      if (convId) body.conversation_id = parseInt(convId, 10);
      const res = await aiReview(projectId, body);
      setR(res);
    } catch (e) {
      setR({ summary: `error: ${e instanceof Error ? e.message : String(e)}`, concerns: [], suggested_followups: [] });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-muted leading-snug">
        Review the diff produced by a conversation OR vs a snapshot label.
      </p>
      <input value={snapshot} onChange={(e) => setSnapshot(e.target.value)} placeholder="from_snapshot label"
        className="w-full rounded-sm border border-border bg-bg px-2 py-1 text-xs font-sans focus:outline-none focus:border-fg" />
      <input value={convId} onChange={(e) => setConvId(e.target.value)} placeholder="conversation_id"
        className="w-full rounded-sm border border-border bg-bg px-2 py-1 text-xs font-mono focus:outline-none focus:border-fg" />
      <Btn variant="primary" size="sm" disabled={busy} onClick={go}>{busy ? 'Reviewing…' : 'Run review'}</Btn>

      {r && (
        <div className="space-y-2">
          <Card>
            <Caption>Summary</Caption>
            <p className="mt-1 text-[12px] text-fg leading-snug">{r.summary || <em className="text-muted">empty</em>}</p>
          </Card>
          {r.concerns.length > 0 && (
            <ul className="space-y-1">
              {r.concerns.map((c, i) => (
                <li key={i} className="rounded-sm border border-border bg-bg p-2">
                  <div className="flex items-baseline gap-2">
                    <SeverityBadge severity={c.severity} />
                    <span className="font-mono text-[11px] truncate">{c.path}:{c.line}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-fg leading-snug">{c.comment}</p>
                </li>
              ))}
            </ul>
          )}
          {r.suggested_followups.length > 0 && (
            <Card>
              <Caption>Follow-ups</Caption>
              <ul className="mt-1 ml-4 list-disc text-[11px] text-fg">
                {r.suggested_followups.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function ReadmeTool({ projectId }: { projectId: number }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <p className="text-[11px] text-muted leading-snug">
        Regenerate <code className="font-mono">/README.md</code> from project state. Auto-pinned, overwrites existing.
      </p>
      <Btn variant="primary" size="sm" disabled={busy} onClick={async () => {
        setBusy(true); setMsg(null);
        try { const r = await aiRegenerateReadme(projectId); setMsg(`Wrote ${r.bytes}B (${r.tokens} tokens).`); }
        catch (e) { setMsg(`error: ${e instanceof Error ? e.message : String(e)}`); }
        finally { setBusy(false); }
      }}>
        {busy ? 'Regenerating…' : 'Regenerate README'}
      </Btn>
      {msg && <p className="text-[11px] text-fg">{msg}</p>}
    </div>
  );
}

function PasteTool({ projectId }: { projectId: number }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [r, setR] = useState<{ classification: { kind: string; suggested_path: string; reason: string }; written?: { path: string; version: number } | null } | null>(null);
  async function go(commit: boolean) {
    setBusy(true);
    try { setR(await aiSmartPaste(projectId, text, commit)); }
    finally { setBusy(false); }
  }
  return (
    <div className="space-y-2">
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} placeholder="Paste content here…"
        className="w-full rounded-sm border border-border bg-bg px-2 py-1 font-mono text-[11px] focus:outline-none focus:border-fg" />
      <div className="flex gap-1.5">
        <Btn variant="secondary" size="sm" disabled={busy || !text.trim()} onClick={() => go(false)}>Classify</Btn>
        <Btn variant="primary" size="sm" disabled={busy || !text.trim()} onClick={() => go(true)}>Classify + Save</Btn>
      </div>
      {r && (
        <Card>
          <Stat label="Kind" value={r.classification.kind} />
          <Stat label="Suggested path" value={r.classification.suggested_path} />
          <p className="mt-2 text-[11px] text-muted leading-snug">{r.classification.reason}</p>
          {r.written && (
            <p className="mt-2 text-[11px] text-emerald-700">
              Saved {r.written.path} v{r.written.version}
            </p>
          )}
        </Card>
      )}
    </div>
  );
}

function FaqTool({ projectId }: { projectId: number }) {
  const [q, setQ] = useState('');
  const [a, setA] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <p className="text-[11px] text-muted leading-snug">
        Append to <code className="font-mono">/FAQ.md</code>; the agent dedupes near-duplicates.
      </p>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Question"
        className="w-full rounded-sm border border-border bg-bg px-2 py-1 text-xs font-sans focus:outline-none focus:border-fg" />
      <textarea value={a} onChange={(e) => setA(e.target.value)} rows={4} placeholder="Answer"
        className="w-full rounded-sm border border-border bg-bg px-2 py-1 text-xs font-sans focus:outline-none focus:border-fg" />
      <Btn variant="primary" size="sm" disabled={busy || !q.trim() || !a.trim()} onClick={async () => {
        setBusy(true); setMsg(null);
        try { const r = await aiFaqAppend(projectId, q, a); setMsg(`Appended (${r.tokens} tokens).`); setQ(''); setA(''); }
        catch (e) { setMsg(`error: ${e instanceof Error ? e.message : String(e)}`); }
        finally { setBusy(false); }
      }}>
        {busy ? 'Updating…' : 'Append'}
      </Btn>
      {msg && <p className="text-[11px] text-fg">{msg}</p>}
    </div>
  );
}

function PlaybookTool({ projectId }: { projectId: number }) {
  const [goal, setGoal] = useState('');
  const [busy, setBusy] = useState(false);
  const [pb, setPb] = useState<{ goal: string; steps: { title: string; description: string; risk?: string }[]; playbook_id?: number } | null>(null);
  return (
    <div className="space-y-2">
      <p className="text-[11px] text-muted leading-snug">
        Generate a migration playbook (steps stored in DB).
      </p>
      <input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="e.g. React 17 → 18"
        className="w-full rounded-sm border border-border bg-bg px-2 py-1 text-xs font-sans focus:outline-none focus:border-fg" />
      <Btn variant="primary" size="sm" disabled={busy || !goal.trim()} onClick={async () => {
        setBusy(true);
        try { setPb(await aiGeneratePlaybook(projectId, goal)); }
        finally { setBusy(false); }
      }}>
        {busy ? 'Generating…' : 'Generate'}
      </Btn>
      {pb && (
        <Card>
          <Caption>{pb.goal}{pb.playbook_id && <span className="ml-2 text-muted">#{pb.playbook_id}</span>}</Caption>
          <ol className="mt-2 space-y-2">
            {pb.steps.map((s, i) => (
              <li key={i} className="border-l-2 border-border pl-3">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-[10px] text-muted">{String(i + 1).padStart(2, '0')}</span>
                  <span className="text-[12px] font-medium">{s.title}</span>
                  {s.risk && <RiskChip risk={s.risk} />}
                </div>
                <p className="mt-0.5 text-[11px] text-muted leading-snug">{s.description}</p>
              </li>
            ))}
          </ol>
        </Card>
      )}
    </div>
  );
}

function RiskChip({ risk }: { risk: string }) {
  const map: Record<string, string> = {
    high: 'border-red-300 bg-red-50 text-red-700',
    medium: 'border-amber-300 bg-amber-50 text-amber-800',
    low: 'border-emerald-300 bg-emerald-50 text-emerald-700',
  };
  return (
    <span className={`rounded-sm border px-1.5 py-0 text-[9px] uppercase tracking-[0.18em] font-sans ${map[risk] ?? 'border-border bg-panel text-muted'}`}>
      {risk}
    </span>
  );
}
