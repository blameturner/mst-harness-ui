export interface EnrichmentAgentCreateBody {
  name: string;
  description?: string;
  category?: string;
  token_budget?: number;
  cron_expression: string;
  timezone?: string;
  active?: boolean;
}
