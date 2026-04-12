import type { ConversationStatus } from './ConversationStatus';

export interface Conversation {
  Id: number;
  org_id: number;
  model: string;
  title: string;
  status?: ConversationStatus;
  contextual_grounding_enabled?: boolean;
  deleted_at?: string | null;
  CreatedAt?: string;
  UpdatedAt?: string;
}
