import { http } from '../../lib/http';
import { defaultOrgId } from '../home/config';
import type {
  GiteaStatus,
  LintIssue,
  Project,
  ProjectAuditEvent,
  ProjectFile,
  ProjectFileVersion,
  ProjectSnapshot,
} from './types';

const orgQ = (org_id?: number) => `org_id=${org_id ?? defaultOrgId()}`;

// ---- Project CRUD ----
export const listProjects = (archived = false) =>
  http.get(`api/projects?${orgQ()}&archived=${archived ? 'true' : 'false'}`).json<{ projects: Project[] }>();

export const getProject = (id: number) =>
  http.get(`api/projects/${id}?${orgQ()}`).json<{ project: Project; file_count: number; latest_activity_at: string }>();

export const createProject = (body: {
  name: string;
  description?: string;
  system_note?: string;
  default_model?: string;
  retrieval_scope?: string[];
}) =>
  http
    .post('api/projects', { json: { ...body, org_id: defaultOrgId() } })
    .json<{ project: Project }>();

export const patchProject = (id: number, patch: Partial<Project>) =>
  http.patch(`api/projects/${id}?${orgQ()}`, { json: patch }).json<{ project: Project }>();

export const archiveProject = (id: number) =>
  http.post(`api/projects/${id}/archive?${orgQ()}`).json<{ ok: boolean }>();

// ---- Filesystem ----
export const listProjectFiles = (id: number, prefix?: string) =>
  http.get(`api/projects/${id}/fs?${orgQ()}${prefix ? `&prefix=${encodeURIComponent(prefix)}` : ''}`)
    .json<{ files: ProjectFile[] }>();

export const readProjectFile = (id: number, path: string) =>
  http.get(`api/projects/${id}/fs/file?${orgQ()}&path=${encodeURIComponent(path)}`)
    .json<{ file: ProjectFile; current_version: ProjectFileVersion }>();

export const listFileVersions = (id: number, path: string) =>
  http.get(`api/projects/${id}/fs/file/versions?${orgQ()}&path=${encodeURIComponent(path)}`)
    .json<{ versions: ProjectFileVersion[] }>();

export const fileDiff = (id: number, path: string, from?: number, to?: number) => {
  const q = new URLSearchParams();
  q.set('org_id', String(defaultOrgId()));
  q.set('path', path);
  if (from != null) q.set('from_version', String(from));
  if (to != null) q.set('to_version', String(to));
  return http.get(`api/projects/${id}/fs/file/diff?${q}`).json<{ unified: string }>();
};

export const writeProjectFile = (
  id: number,
  body: { path: string; content: string; edit_summary?: string; kind?: string; mime?: string; if_content_hash?: string },
) =>
  http.put(`api/projects/${id}/fs/file?${orgQ()}`, { json: body, throwHttpErrors: false })
    .json<{ file: ProjectFile; version: ProjectFileVersion; changed: boolean } & { error?: string; expected?: string; actual?: string }>();

export const deleteProjectFile = (id: number, path: string) =>
  http.delete(`api/projects/${id}/fs/file?${orgQ()}&path=${encodeURIComponent(path)}`).json<{ ok: boolean }>();

export const restoreVersion = (id: number, path: string, version: number) =>
  http.post(`api/projects/${id}/fs/file/restore?${orgQ()}`, { json: { path, version } })
    .json<{ file: ProjectFile; version: ProjectFileVersion; changed: boolean }>();

export const setPin = (id: number, path: string, pinned: boolean) =>
  http.post(`api/projects/${id}/fs/file/pin?${orgQ()}`, { json: { path, pinned } }).json<{ ok: boolean }>();

export const setLock = (id: number, path: string, locked: boolean) =>
  http.post(`api/projects/${id}/fs/file/lock?${orgQ()}`, { json: { path, locked } }).json<{ ok: boolean }>();

export const moveFile = (id: number, from: string, to: string) =>
  http.post(`api/projects/${id}/fs/move?${orgQ()}`, { json: { from, to } }).json<{ file: ProjectFile }>();

export const searchFiles = (id: number, q: string) =>
  http.get(`api/projects/${id}/fs/search?${orgQ()}&q=${encodeURIComponent(q)}`)
    .json<{ hits: { path: string; version: number; snippet: string }[] }>();

export const exportZipUrl = (id: number) => {
  // Construction relies on gateway proxying with credentials
  return `api/projects/${id}/fs/export?${orgQ()}&format=zip`;
};

export const bulkImportFiles = (id: number, files: { path: string; content: string }[]) =>
  http.post(`api/projects/${id}/fs/import?${orgQ()}`, { json: { files } }).json<{ written: number; skipped: number }>();

// ---- Snapshots & branches ----
export const listSnapshots = (id: number) =>
  http.get(`api/projects/${id}/snapshots?${orgQ()}`).json<{ snapshots: ProjectSnapshot[] }>();

export const createSnapshot = (id: number, label: string, description = '') =>
  http.post(`api/projects/${id}/snapshots?${orgQ()}`, { json: { label, description } })
    .json<{ snapshot: ProjectSnapshot }>();

export const snapshotDiff = (id: number, label: string) =>
  http.get(`api/projects/${id}/snapshots/${encodeURIComponent(label)}/diff?${orgQ()}`)
    .json<{ snapshot: ProjectSnapshot; files: { path: string; state: string; unified: string }[] }>();

export const branchProject = (id: number, name: string, fromSnapshot?: string) =>
  http.post(`api/projects/${id}/branch?${orgQ()}`, { json: { name, from_snapshot: fromSnapshot } })
    .json<{ project_id: number; files_written: number; parent_project_id: number }>();

// ---- Audit / open work / metrics / history / feed ----
export const projectAudit = (id: number, kind?: string, limit = 200) => {
  const q = new URLSearchParams({ org_id: String(defaultOrgId()), limit: String(limit) });
  if (kind) q.set('kind', kind);
  return http.get(`api/projects/${id}/audit?${q}`).json<{ events: ProjectAuditEvent[] }>();
};

export const projectFeed = (id: number, hours = 24) =>
  http.get(`api/projects/${id}/feed?${orgQ()}&hours=${hours}`).json<{ events: ProjectAuditEvent[] }>();

export const openWork = (id: number) =>
  http.get(`api/projects/${id}/open-work?${orgQ()}`)
    .json<{ open_todos: number; permission_requests: { path: string; reason: string; created_at: string }[]; permission_request_count: number; file_count: number }>();

export const projectMetrics = (id: number, period = '30d') =>
  http.get(`api/projects/${id}/metrics?${orgQ()}&period=${period}`).json<Record<string, unknown>>();

export const projectHistory = (id: number, limit = 200) =>
  http.get(`api/projects/${id}/history?${orgQ()}&limit=${limit}`)
    .json<{ events: { path: string; version: number; edit_summary: string; created_at: string }[]; total_versions: number }>();

// ---- Analysis ----
export const runLint = (id: number, path?: string) =>
  http.post(`api/projects/${id}/lint?${orgQ()}${path ? `&path=${encodeURIComponent(path)}` : ''}`)
    .json<{ files: { path: string; issues: LintIssue[] }[]; issues_total: number; files_scanned: number }>();

export const listIssues = (id: number, severity?: string) => {
  const q = new URLSearchParams({ org_id: String(defaultOrgId()), limit: '1000' });
  if (severity) q.set('severity', severity);
  return http.get(`api/projects/${id}/issues?${q}`).json<{ issues: LintIssue[] }>();
};

export const listSymbols = (id: number, q?: string) =>
  http.get(`api/projects/${id}/symbols?${orgQ()}${q ? `&q=${encodeURIComponent(q)}` : ''}`)
    .json<{ symbols: { path: string; name: string; kind: string; line: number; signature: string }[] }>();

export const importGraph = (id: number) =>
  http.get(`api/projects/${id}/graph?${orgQ()}`)
    .json<{ elements: { nodes: { data: { id: string; label: string } }[]; edges: { data: { source: string; target: string } }[] } }>();

export const complexity = (id: number, threshold = 10) =>
  http.get(`api/projects/${id}/complexity?${orgQ()}&threshold=${threshold}`)
    .json<{ files: { path: string; complexity: number; over_threshold: boolean }[] }>();

export const docCoverage = (id: number) =>
  http.get(`api/projects/${id}/doc-coverage?${orgQ()}`)
    .json<{ files: { path: string; total: number; documented: number; coverage: number }[]; total_symbols: number; documented: number; overall_coverage: number }>();

export const testDiscovery = (id: number) =>
  http.get(`api/projects/${id}/tests?${orgQ()}`)
    .json<{ test_files: number; total_tests: number; files: { path: string; count: number }[] }>();

export const dependencies = (id: number) =>
  http.get(`api/projects/${id}/dependencies?${orgQ()}`)
    .json<{ dependencies: { manager: string; name: string; version: string; scope: string }[] }>();

// ---- Gitea ----
export const giteaStatus = (id: number) =>
  http.get(`api/projects/${id}/gitea/status?${orgQ()}`).json<GiteaStatus>();

export const pushToGitea = (id: number, body: { branch?: string; message: string; paths?: string[]; force?: boolean }) =>
  http.post(`api/projects/${id}/push-to-gitea?${orgQ()}`, { json: { ...body, scope: 'current' }, throwHttpErrors: false })
    .json<{ branch?: string; pushed?: number; skipped?: number; failures?: { path: string; error: string }[]; head_sha?: string;
            detail?: { reason: string; remote_head_sha?: string; behind_count?: number; hint?: string } }>();

export const giteaPullPreview = (id: number) =>
  http.get(`api/projects/${id}/gitea/pull/preview?${orgQ()}`)
    .json<{ remote_head_sha: string; files: { path: string; state: string; remote_sha?: string; remote_size?: number; local_version?: number; diff: string | null }[] }>();

export const giteaPullApply = (id: number, decisions: { path: string; choice: string }[], setSyncedTo: string) =>
  http.post(`api/projects/${id}/gitea/pull/apply?${orgQ()}`, { json: { decisions, set_synced_to: setSyncedTo } })
    .json<{ applied: { path: string; choice: string; project_id?: number }[] }>();

export const getGiteaConnection = () =>
  http.get(`api/gitea/connection?${orgQ()}`).json<{ connection: { base_url: string; username: string; access_token: string; verified_at?: string } | null }>();

export const upsertGiteaConnection = (body: { base_url: string; username: string; access_token: string; default_branch?: string }) =>
  http.put('api/gitea/connection', { json: { ...body, org_id: defaultOrgId() } })
    .json<{ connection: { base_url: string; username: string }; verified_as: string; is_admin?: boolean; server_version?: string }>();

export const deleteGiteaConnection = () =>
  http.delete(`api/gitea/connection?${orgQ()}`).json<{ ok: boolean }>();

export const testGiteaConnection = () =>
  http.post(`api/gitea/connection/test?${orgQ()}`).json<{ ok: boolean; login?: string; server_version?: string; error?: string }>();

export const listGiteaOrgs = () =>
  http.get(`api/gitea/orgs?${orgQ()}`).json<{ orgs: { username: string; full_name?: string }[] }>();

export const listGiteaRepos = (limit = 50) =>
  http.get(`api/gitea/repos?${orgQ()}&limit=${limit}`).json<{ repos: { full_name: string; default_branch?: string; private?: boolean }[] }>();

export const importFromGitea = (body: { owner: string; repo: string; ref?: string; name: string; ignore?: string[] }) =>
  http.post('api/projects/import-from-gitea', { json: { ...body, org_id: defaultOrgId() } })
    .json<{ project_id: number; written: number; skipped: number }>();

export const createGiteaRepoForProject = (id: number, body: {
  owner: string; owner_kind: 'user' | 'org'; repo: string; description?: string;
  private?: boolean; default_branch?: string; init_readme?: boolean;
}) => http.post(`api/projects/${id}/create-gitea-repo?${orgQ()}`, { json: body })
    .json<{ repo: Record<string, unknown>; pushed: number; head_sha: string }>();

// ---- Snapshots / share ----
export const createShareLink = (id: number, expiresInDays = 30) =>
  http.post(`api/projects/${id}/share?${orgQ()}`, { json: { expires_in_days: expiresInDays } })
    .json<{ token: string; url_path: string; expires_at: string | null }>();

// ---- Project chat (project-aware code) ----
export const projectChat = (id: number, body: {
  model: string;
  message: string;
  mode: string;
  approved_plan?: string;
  conversation_id?: number;
  response_style?: string;
  interactive_fs?: boolean;
}) => http.post(`api/projects/${id}/chat?${orgQ()}`, { json: body }).json<{ job_id: string }>();

// ---- Bulk plumbing ----
export const previewPlanApply = (id: number, messageId: number) =>
  http.post(`api/projects/${id}/plans/${messageId}/preview?${orgQ()}`, { json: {} })
    .json<{ items: { path: string; action: string; existing_size?: number }[] }>();

export const adrCreate = (id: number, body: { title: string; context?: string; decision?: string; consequences?: string }) =>
  http.post(`api/projects/${id}/adrs?${orgQ()}`, { json: body })
    .json<{ path: string; number: number; file: ProjectFile; version: ProjectFileVersion }>();

export const findReplace = (id: number, body: { pattern: string; replacement: string; paths?: string[]; regex?: boolean; dry_run?: boolean }) =>
  http.post(`api/projects/${id}/fs/replace?${orgQ()}`, { json: body })
    .json<{ dry_run: boolean; files?: { path: string; unified: string }[]; written?: number; count?: number }>();

export const renameSymbol = (id: number, body: { old: string; new: string; paths?: string[] }) =>
  http.post(`api/projects/${id}/rename?${orgQ()}`, { json: body })
    .json<{ files: { path: string; occurrences: number }[]; file_count: number }>();

// ---- AI flows ----
export interface ReviewResult {
  summary: string;
  concerns: { path: string; line: number; severity: string; comment: string }[];
  suggested_followups: string[];
  tokens?: number;
  stored_id?: number;
}

export const aiReview = (id: number, body: { from_snapshot?: string; conversation_id?: number; paths?: string[] }) =>
  http.post(`api/projects/${id}/review?${orgQ()}`, { json: body }).json<ReviewResult>();

export const aiFileSummary = (id: number, path: string) =>
  http.post(`api/projects/${id}/fs/file/summary?${orgQ()}`, { json: { path } })
    .json<{ path: string; summary: string; tokens: number }>();

export const aiRegenerateReadme = (id: number) =>
  http.post(`api/projects/${id}/readme/regenerate?${orgQ()}`).json<{ ok: boolean; tokens: number; bytes: number }>();

export const aiFaqAppend = (id: number, question: string, answer: string) =>
  http.post(`api/projects/${id}/faq/append?${orgQ()}`, { json: { question, answer } })
    .json<{ ok: boolean; tokens: number }>();

export const aiSmartPaste = (id: number, text: string, commit = false) =>
  http.post(`api/projects/${id}/smart-paste?${orgQ()}`, { json: { text, commit } })
    .json<{ classification: { kind: string; language: string; suggested_path: string; reason: string }; written?: { path: string; version: number } | null }>();

export const aiGeneratePlaybook = (id: number, goal: string) =>
  http.post(`api/projects/${id}/playbooks/generate?${orgQ()}`, { json: { goal } })
    .json<{ playbook_id?: number; goal: string; steps: { title: string; description: string; scope_paths?: string[]; risk?: string }[]; tokens?: number }>();

export const aiRegenFromSpec = (id: number, spec_path: string, targets: string[]) =>
  http.post(`api/projects/${id}/scaffold-from-spec/regenerate?${orgQ()}`, { json: { spec_path, targets } })
    .json<{ spec: string; files: { path: string; version?: number; changed?: boolean; skipped?: boolean; tokens: number; error?: string }[] }>();
