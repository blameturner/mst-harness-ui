// Tables that have a deleted_at column. Queries on these must filter (deleted_at,is,null).
export const SOFT_DELETE_TABLES: ReadonlySet<string> = new Set([
  'organisations',
  'users',
  'agents',
  'workers',
  'agent_schedules',
  'agent_memory',
  'observations',
  'tasks',
  'conversations',
  'knowledge_sources',
  'scrape_targets',
  'training_examples',
  'notifications',
  'project_members',
]);
