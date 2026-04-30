import { http } from '../../lib/http';
import { gatewayUrl } from '../../lib/runtime-env';
import { defaultOrgId } from '../home/config';

export interface AdminSubsystem {
  id: string;
  label: string;
  job_types: string[];
  supports_trigger: boolean;
  feature_section?: string | null;
}

export interface AdminSubsystemsResponse {
  subsystems: AdminSubsystem[];
}

export interface AdminRuntimeRow {
  id: string;
  label: string;
  enabled?: boolean;
  in_flight?: number;
  queued?: number;
  running?: number;
  completed_24h?: number;
  failed_24h?: number;
  last_run_at?: string | null;
  last_run_status?: string | null;
  last_run_error?: string | null;
  next_scheduled_at?: string | null;
  next_scheduled_label?: string | null;
  feature_section?: string | null;
  job_types?: string[];
  supports_trigger?: boolean;
}

export interface AdminHueyBlock {
  consumer_running?: boolean;
  consumer_healthy?: boolean;
  workers?: number;
  active_workers?: number;
  pending?: number;
  scheduled?: number;
}

export interface AdminQueueBlock {
  total?: number;
  by_status?: Record<string, number>;
  backoff?: { state?: string; remaining_s?: number | null } | null;
}

export interface AdminSchedulerBlock {
  running?: boolean;
  next_fire_at?: string | null;
  jobs?: number;
}

export interface AdminRuntimeResponse {
  subsystems: AdminRuntimeRow[];
  huey?: AdminHueyBlock;
  queue?: AdminQueueBlock;
  scheduler?: AdminSchedulerBlock;
}

export interface AdminConfigSection {
  section: string;
  value: Record<string, unknown>;
}

export interface AdminConfigResponse {
  sections: AdminConfigSection[];
}

export interface AdminTriggerRequest {
  payload?: Record<string, unknown>;
  org_id?: number;
  bypass_idle?: boolean;
  priority?: number;
}

export interface AdminTriggerResponse {
  job_id: string;
}

export interface TriggerSchemaField {
  name: string;
  type: 'string' | 'number' | 'integer' | 'boolean' | 'enum' | 'array' | 'object';
  default?: unknown;
  options?: Array<string | number>;
  description?: string;
  min?: number;
  max?: number;
}

export interface TriggerSchemaResponse {
  subsystem: string;
  label: string;
  trigger_supported: boolean;
  trigger_job_type?: string;
  description?: string;
  required: TriggerSchemaField[];
  optional: TriggerSchemaField[];
}

export interface SubsystemToggleResponse {
  subsystem: string;
  section: string;
  enabled: boolean;
  value: Record<string, unknown>;
}

const orgParam = () => ({ org_id: defaultOrgId() });

export const adminApi = {
  runtime: () =>
    http.get('api/admin/runtime', { searchParams: orgParam() }).json<AdminRuntimeResponse>(),
  subsystems: () =>
    http.get('api/admin/subsystems').json<AdminSubsystemsResponse>(),
  config: () =>
    http.get('api/admin/config', { searchParams: orgParam() }).json<AdminConfigResponse>(),
  configSection: (section: string) =>
    http
      .get(`api/admin/config/${encodeURIComponent(section)}`, { searchParams: orgParam() })
      .json<AdminConfigSection>(),
  patchConfig: (section: string, value: Record<string, unknown>) =>
    http
      .patch(`api/admin/config/${encodeURIComponent(section)}`, {
        json: { value },
      })
      .json<AdminConfigSection>(),
  trigger: (subsystemId: string, body: AdminTriggerRequest = {}) =>
    http
      .post(`api/admin/trigger/${encodeURIComponent(subsystemId)}`, {
        json: { org_id: defaultOrgId(), bypass_idle: true, ...body },
      })
      .json<AdminTriggerResponse>(),
  triggerSchema: (subsystemId: string) =>
    http
      .get(`api/admin/trigger/${encodeURIComponent(subsystemId)}/schema`)
      .json<TriggerSchemaResponse>(),
  enable: (subsystemId: string) =>
    http
      .post(`api/admin/subsystems/${encodeURIComponent(subsystemId)}/enable`, {
        json: orgParam(),
      })
      .json<SubsystemToggleResponse>(),
  disable: (subsystemId: string) =>
    http
      .post(`api/admin/subsystems/${encodeURIComponent(subsystemId)}/disable`, {
        json: orgParam(),
      })
      .json<SubsystemToggleResponse>(),
};

export function queueEventStreamUrl(): string {
  return `${gatewayUrl()}/api/tool-queue/events?org_id=${defaultOrgId()}`;
}
