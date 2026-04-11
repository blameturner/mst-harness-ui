import type { ConversationStatus } from './ConversationStatus';

export interface CodeConversation {
  Id: number;
  org_id: number;
  model: string;
  title: string;
  status?: ConversationStatus;
  // mode is stored in the rag_collection column on the backend
  mode?: 'plan' | 'execute' | 'debug';
  rag_collection?: string | null;
  CreatedAt?: string;
  UpdatedAt?: string;
}
