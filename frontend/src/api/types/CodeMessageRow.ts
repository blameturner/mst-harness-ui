import type { ChatRole } from './ChatRole';

export interface CodeMessageRow {
  Id: number;
  conversation_id: number;
  role: ChatRole;
  content: string;
  mode?: 'plan' | 'execute' | 'debug' | null;
  files_json?: string | null;
  response_style?: string | null;
  CreatedAt?: string;
}
