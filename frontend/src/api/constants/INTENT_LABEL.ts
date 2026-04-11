import type { ChatIntent } from '../types/ChatIntent';

export const INTENT_LABEL: Partial<Record<ChatIntent, string>> = {
  contextual_enrichment: 'Grounded',
  factual_lookup: 'Lookup',
  explanatory: 'Explained',
  recommendation: 'Suggestions',
  comparison: 'Compared',
  research_synthesis: 'Research',
  troubleshooting: 'Diagnosing',
  code_explain: 'Code · explain',
  code_review: 'Code · review',
  code_refactor: 'Code · refactor',
  code_debug: 'Code · debug',
  code_build: 'Code · build',
  code_test: 'Code · test',
  code_optimise: 'Code · optimise',
  code_security: 'Code · security',
  code_lookup: 'Code · lookup',
  task_remember: 'Task · remember',
  task_schedule: 'Task · schedule',
  task_summarise_input: 'Task · summarise',
};
