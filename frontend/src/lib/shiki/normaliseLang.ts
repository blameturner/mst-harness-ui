import type { BundledLanguage } from 'shiki';

const LANG_ALIAS: Record<string, BundledLanguage> = {
  js: 'javascript',
  jsx: 'jsx',
  ts: 'typescript',
  tsx: 'tsx',
  py: 'python',
  python: 'python',
  rb: 'ruby',
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',
  shell: 'shell',
  rs: 'rust',
  go: 'go',
  yml: 'yaml',
  md: 'markdown',
  json: 'json',
  html: 'html',
  css: 'css',
  sql: 'sql',
  plaintext: 'text' as BundledLanguage,
  text: 'text' as BundledLanguage,
};

export function normaliseLang(input?: string): BundledLanguage {
  const key = (input ?? 'text').toLowerCase();
  return LANG_ALIAS[key] ?? (key as BundledLanguage);
}
