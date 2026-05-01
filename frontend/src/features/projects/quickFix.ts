/** Single source of truth for "pre-load the project chat with this prompt".
 *  SidePanel writes via `setPendingPrompt`; ProjectChat reads + clears it.
 */
export interface PendingPrompt {
  message: string;
  mode: 'chat' | 'plan' | 'apply' | 'review' | 'explain' | 'decide' | 'scaffold';
  autoSend?: boolean;
}

export function buildLintQuickFixPrompt(path: string, line: number | undefined, rule: string, message: string): PendingPrompt {
  const lineHint = line ? ` on line ${line}` : '';
  return {
    mode: 'apply',
    message:
      `Fix this lint issue:\n` +
      `- File: \`${path}\`\n` +
      (line ? `- Line: ${line}\n` : '') +
      `- Rule: \`${rule}\`\n` +
      `- Message: ${message}\n\n` +
      `Edit ONLY \`${path}\`${lineHint}. Output a single fenced \`file\` block with mode=patch (or mode=replace if a tiny file). ` +
      `Do not touch any other file. Keep the change minimal.`,
  };
}
