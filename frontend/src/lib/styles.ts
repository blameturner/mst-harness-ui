export const STYLE_LABELS: Record<string, string> = {
  general: 'General',
  conversational: 'Conversational',
  explanatory: 'Explanatory',
  learning: 'Learning',
  deep_dive: 'Deep Dive',
  direct: 'Direct',
  strategist: 'Strategist',
  challenger: 'Challenger',
  inquisitive: 'Inquisitive',
  explain: 'Explain',
  review: 'Review',
  refactor: 'Refactor',
  debug: 'Debug',
  build: 'Build',
  test: 'Test',
  optimise: 'Optimise',
  security: 'Security',
};

export function styleLabel(key: string | null | undefined): string {
  if (!key) return '';
  return STYLE_LABELS[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
