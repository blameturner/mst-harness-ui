import type { ConversationStatus } from './ConversationStatus';

export interface Conversation {
  Id: number;
  org_id: number;
  model: string;
  title: string;
  status?: ConversationStatus;
  contextual_grounding_enabled?: boolean;
  CreatedAt?: string;
  UpdatedAt?: string;
}
