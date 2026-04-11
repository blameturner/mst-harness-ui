import { useState } from 'react';
import type { AttachedFile } from './types/AttachedFile';
import type { CodeBlock } from './types/CodeBlock';
import { b64ToUtf8 } from './utils/b64ToUtf8';
import { downloadBlob } from './utils/downloadBlob';
import { DiffView } from './DiffView';
import { ShikiBlock } from './ShikiBlock';

export function CodeBlockCard({
  block,
  workspace,
}: {
  block: CodeBlock;
  workspace: AttachedFile[];
}) {
  const [showDiff, setShowDiff] = useState(true);
  const existing = block.file
    ? workspace.find((w) => w.name === block.file || w.name.endsWith('/' + block.file))
    : undefined;
  const existingText = existing?.content ?? (existing ? b64ToUtf8(existing.content_b64) : '');
  const saveName = block.file ?? `snippet.${block.lang === 'text' ? 'txt' : block.lang}`;
  return (
    <div className="border border-border rounded-md overflow-hidden">
      <div className="px-3 py-1.5 bg-panel/60 border-b border-border text-[10px] uppercase tracking-[0.14em] font-sans text-muted flex items-center justify-between gap-2">
        <span className="truncate">
          {block.file ? (
            <>
              <span className="text-fg">{block.file}</span>
              <span className="ml-2">· {block.lang}</span>
            </>
          ) : (
            block.lang
          )}
        </span>
        <div className="flex items-center gap-3 shrink-0">
          {existing && (
            <button onClick={() => setShowDiff((d) => !d)} className="hover:text-fg">
              {showDiff ? 'Raw' : 'Diff'}
            </button>
          )}
          <button
            onClick={() => void navigator.clipboard.writeText(block.code)}
            className="hover:text-fg"
          >
            Copy
          </button>
          <button onClick={() => downloadBlob(saveName, block.code)} className="hover:text-fg">
            Save
          </button>
        </div>
      </div>
      {existing && showDiff ? (
        <DiffView before={existingText} after={block.code} />
      ) : (
        <ShikiBlock code={block.code} lang={block.lang} />
      )}
    </div>
  );
}
