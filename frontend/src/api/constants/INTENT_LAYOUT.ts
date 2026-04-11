import type { ChatIntent } from '../types/ChatIntent';
import type { IntentSourceLayout } from '../types/IntentSourceLayout';

export const INTENT_LAYOUT: Record<ChatIntent, IntentSourceLayout> = {
  chitchat: 'hidden',
  contextual_enrichment: 'collapsed',
  factual_lookup: 'collapsed',
  explanatory: 'collapsed',
  recommendation: 'collapsed',
  comparison: 'expanded',
  research_synthesis: 'expanded',
  troubleshooting: 'expanded',
  code_explain: 'hidden',
  code_review: 'hidden',
  code_refactor: 'hidden',
  code_debug: 'hidden',
  code_build: 'hidden',
  code_test: 'hidden',
  code_optimise: 'hidden',
  code_security: 'hidden',
  code_lookup: 'collapsed',
  task_remember: 'hidden',
  task_schedule: 'hidden',
  task_summarise_input: 'hidden',
};
