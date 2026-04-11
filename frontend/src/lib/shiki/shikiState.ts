import type { Highlighter } from 'shiki';

// Mutable module singleton shared by getHighlighter and highlightToTokens.
// getHighlighter lazily creates the promise; highlightToTokens tracks which
// langs it has already asked the highlighter to load so repeat calls are free.
export const shikiState: {
  highlighterPromise: Promise<Highlighter> | null;
  loadedLangs: Set<string>;
} = {
  highlighterPromise: null,
  loadedLangs: new Set(),
};
