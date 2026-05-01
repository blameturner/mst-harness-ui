export interface Project {
  Id: number;
  org_id: number;
  name: string;
  slug: string;
  description?: string;
  system_note?: string;
  default_model?: string;
  retrieval_scope?: string[] | string;
  chroma_collection?: string;
  archived_at?: string | null;
  parent_project_id?: number | null;
  gitea_origin?: string;
  gitea_last_synced_sha?: string;
  gitea_last_synced_at?: string;
  precommit_chain?: string[];
  CreatedAt?: string;
  UpdatedAt?: string;
}

export interface ProjectFile {
  Id: number;
  project_id: number;
  path: string;
  current_version_id?: number;
  kind?: string;
  mime?: string;
  size_bytes?: number;
  pinned?: boolean | number;
  locked?: boolean | number;
  watermark?: boolean | number;
  preferred_model?: string;
  archived_at?: string | null;
  CreatedAt?: string;
  UpdatedAt?: string;
}

export interface ProjectFileVersion {
  Id: number;
  file_id: number;
  version: number;
  content: string;
  content_hash?: string;
  parent_version_id?: number | null;
  edit_summary?: string;
  conversation_id?: number | null;
  created_by_message_id?: number | null;
  pushed_to_sha?: string | null;
  CreatedAt?: string;
}

export interface ProjectAuditEvent {
  Id: number;
  project_id: number;
  actor: string;
  kind: string;
  payload?: Record<string, unknown>;
  CreatedAt?: string;
}

export interface ProjectSnapshot {
  Id: number;
  label: string;
  description?: string;
  created_by?: string;
  CreatedAt?: string;
  file_count?: number;
}

export interface LintIssue {
  Id?: number;
  project_id?: number;
  file_id?: number;
  version?: number;
  line?: number;
  col?: number;
  severity: 'info' | 'warning' | 'error' | 'security';
  rule: string;
  message: string;
}

export interface GiteaStatus {
  linked: boolean;
  origin?: string;
  ahead?: string[];
  behind_count?: number;
  remote_head_sha?: string;
  last_synced_sha?: string;
  last_synced_at?: string;
  state?: 'in_sync' | 'ahead' | 'behind' | 'diverged' | 'unlinked';
}
