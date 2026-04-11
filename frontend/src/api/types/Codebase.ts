export interface Codebase {
  id: number;
  org_id: number;
  name: string;
  description: string;
  collection_name: string;
  source: string | null;
  records: number;
  created_at: string | null;
  updated_at: string | null;
}
