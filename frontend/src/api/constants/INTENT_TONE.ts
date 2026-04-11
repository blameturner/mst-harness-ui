import type { ChatIntent } from '../types/ChatIntent';

const emerald = 'border-emerald-600/40 text-emerald-400 bg-emerald-500/10';
const stone = 'border-stone-600/40 text-muted bg-stone-500/10';

export const INTENT_TONE: Record<ChatIntent, string> = {
  chitchat: '',
  contextual_enrichment: 'border-sky-600/40 text-sky-400 bg-sky-500/10',
  factual_lookup: 'border-blue-600/40 text-blue-400 bg-blue-500/10',
  explanatory: 'border-indigo-600/40 text-indigo-400 bg-indigo-500/10',
  recommendation: 'border-teal-600/40 text-teal-400 bg-teal-500/10',
  comparison: 'border-purple-600/40 text-purple-400 bg-purple-500/10',
  research_synthesis: 'border-violet-600/40 text-violet-400 bg-violet-500/10',
  troubleshooting: 'border-amber-600/40 text-amber-400 bg-amber-500/10',
  code_explain: emerald,
  code_review: emerald,
  code_refactor: emerald,
  code_debug: emerald,
  code_build: emerald,
  code_test: emerald,
  code_optimise: emerald,
  code_security: emerald,
  code_lookup: emerald,
  task_remember: stone,
  task_schedule: stone,
  task_summarise_input: stone,
};
