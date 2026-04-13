import type { CodeMessage } from '../types/CodeMessage';
import type { Mode } from '../types/Mode';
import type { CodeBlock } from '../types/CodeBlock';
import { parseCodeBlocks } from './parseCodeBlocks';

export interface CodeBlockGroup {
  messageId: string;
  mode: Mode;
  userPrompt: string;
  blocks: CodeBlock[];
  isLatest: boolean;
}

export function groupCodeBlocksByMessage(messages: CodeMessage[]): CodeBlockGroup[] {
  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');

  return messages
    .map((m, mi) => {
      if (m.role !== 'assistant' || !m.content) return null;
      const blocks = parseCodeBlocks(m.content);
      if (blocks.length === 0) return null;

      let userPrompt = '';
      for (let j = mi - 1; j >= 0; j--) {
        if (messages[j].role === 'user') {
          userPrompt = messages[j].content.slice(0, 80);
          break;
        }
      }
      return { messageId: m.id, mode: m.mode, userPrompt, blocks, isLatest: m === lastAssistant };
    })
    .filter(Boolean) as CodeBlockGroup[];
}

