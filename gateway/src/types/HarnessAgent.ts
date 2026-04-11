export interface HarnessAgent {
  Id: number;
  name: string;
  display_name: string;
  model: string;
  status: string | null;
  org_id?: number;
  worker_type?: string;
  product?: string;
  task_description?: string;
}
