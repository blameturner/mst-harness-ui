import { createHighlighter, type Highlighter } from 'shiki';
import { LIGHT_THEME } from './LIGHT_THEME';
import { DARK_THEME } from './DARK_THEME';
import { shikiState } from './shikiState';

export async function getHighlighter(): Promise<Highlighter> {
  if (!shikiState.highlighterPromise) {
    shikiState.highlighterPromise = createHighlighter({
      themes: [LIGHT_THEME, DARK_THEME],
      langs: ['text', 'typescript', 'tsx', 'javascript', 'python', 'shell', 'json'],
    }).then((h) => {
      for (const l of ['text', 'typescript', 'tsx', 'javascript', 'python', 'shell', 'json']) {
        shikiState.loadedLangs.add(l);
      }
      return h;
    });
  }
  return shikiState.highlighterPromise;
}
