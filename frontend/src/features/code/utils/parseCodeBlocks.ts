import type { CodeBlock } from '../types/CodeBlock';

export function parseCodeBlocks(md: string): CodeBlock[] {
  const out: CodeBlock[] = [];
  const re = /```([\w+-]*)\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(md)) !== null) {
    const lang = m[1] || 'text';
    let code = m[2];
    let file: string | undefined;
    const firstLine = code.split('\n', 1)[0] ?? '';
    const inline = firstLine.match(/^(?:\/\/|#)\s*file:\s*(.+?)\s*$/);
    if (inline) {
      file = inline[1];
      code = code.slice(firstLine.length + 1);
    } else {
      const before = md.slice(0, m.index).trimEnd();
      const lastNl = before.lastIndexOf('\n');
      const prevLine = (lastNl === -1 ? before : before.slice(lastNl + 1)).trim();
      const heading = prevLine.match(/^#{1,6}\s+([\w./\\-]+\.[\w]+)\s*$/);
      if (heading) file = heading[1];
    }
    out.push({ lang, code, file, index: i++ });
  }
  return out;
}
