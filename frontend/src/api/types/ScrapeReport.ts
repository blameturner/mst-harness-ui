export interface ScrapeReport {
  total: number;
  by_status: Record<string, number>;
  by_error: Record<string, number>;
  top_failures: [string, number][];
  persistent_failures: { url: string; consecutive_failures: number; error: string }[];
}
