/** Current (post-redesign) task types emitted by new jobs. */
export const CURRENT_TASK_TYPES = [
  'planned_search_execute',
  'planned_search_scrape',
  'research_planner',
  'research_agent',
  'summarise_page',
  'graph_extract',
  'scrape_page',
  'pathfinder_extract',
  'extract_relationships',
  'discover_agent_run',
] as const;

/** Deprecated task types that may still appear on pre-redesign rows. */
export const LEGACY_TASK_TYPES = new Set<string>([
  'scrape_target',       // → scrape_page
  'pathfinder_crawl',    // → pathfinder_extract
  'classify_relevance',  // removed (inline in discover_agent_run)
]);

const LABELS: Record<string, string> = {
  scrape_page: 'Scrape page',
  pathfinder_extract: 'Pathfinder extract',
  extract_relationships: 'Extract relationships',
  discover_agent_run: 'Discover agent',
  summarise_page: 'Summarise page',
  graph_extract: 'Graph extract',
  planned_search_execute: 'Planned search (execute)',
  planned_search_scrape: 'Planned search (scrape)',
  research_planner: 'Research planner',
  research_agent: 'Research agent',
};

export function taskTypeLabel(type: string | null | undefined): string {
  if (!type) return '-';
  return LABELS[type] ?? type;
}

export function isLegacyTaskType(type: string | null | undefined): boolean {
  return !!type && LEGACY_TASK_TYPES.has(type);
}
