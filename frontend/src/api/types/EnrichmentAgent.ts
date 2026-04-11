export interface EnrichmentAgent {
  Id: number;
  org_id: number;
  name: string;
  description: string;
  category: string;
  token_budget: number;
  cron_expression: string;
  timezone: string;
  active: boolean;
  CreatedAt?: string;
  UpdatedAt?: string;
}
