const TOOL_LABELS: Record<string, string> = {
  web_search: 'Searching the web',
  web_fetch: 'Fetching a page',
  fetch_url: 'Fetching a page',
  code_interpreter: 'Running code',
  python: 'Running code',
  file_search: 'Searching files',
  knowledge_search: 'Checking memory',
  url_scraper: 'Reading an Article'
};

export function labelForTool(tool: string | undefined): string {
  if (!tool) return 'Running tool';
  return TOOL_LABELS[tool] ?? `Running ${tool.replace(/_/g, ' ')}`;
}
