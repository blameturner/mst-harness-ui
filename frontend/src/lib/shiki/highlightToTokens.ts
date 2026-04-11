import type { BundledTheme } from 'shiki';
import { LIGHT_THEME } from './LIGHT_THEME';
import { normaliseLang } from './normaliseLang';
import { getHighlighter } from './getHighlighter';
import { shikiState } from './shikiState';
import type { ShikiToken } from './ShikiToken';

export async function highlightToTokens(
  code: string,
  lang?: string,
  theme: BundledTheme = LIGHT_THEME,
): Promise<{ tokens: ShikiToken[][]; bg: string; fg: string }> {
  const hl = await getHighlighter();
  const resolved = normaliseLang(lang);
  if (!shikiState.loadedLangs.has(resolved)) {
    try {
      await hl.loadLanguage(resolved);
      shikiState.loadedLangs.add(resolved);
    } catch {
      // Fall back to plain text if the requested grammar doesn't exist.
      const result = hl.codeToTokens(code, { lang: 'text', theme });
      return { tokens: result.tokens, bg: result.bg ?? '', fg: result.fg ?? '' };
    }
  }
  const result = hl.codeToTokens(code, { lang: resolved, theme });
  return { tokens: result.tokens, bg: result.bg ?? '', fg: result.fg ?? '' };
}
