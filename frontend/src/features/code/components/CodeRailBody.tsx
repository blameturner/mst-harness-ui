import type { CodeBlockGroup } from '../utils/groupCodeBlocksByMessage';
import type { Codebase } from '../../../api/types/Codebase';
import { CodeBlockCard } from '../CodeBlockCard';
import { CodebaseManager } from '../CodebaseManager';

interface CodeRailBodyProps {
  checklist: string[];
  checked: Record<number, boolean>;
  onChecklistChange: (i: number, checked: boolean) => void;
  onStepPrompt: (stepIdx: number, step: string) => void;
  messageBlocks: CodeBlockGroup[];
  codebases: Codebase[];
  onCodebasesUpdate: (codebases: Codebase[]) => void;
  onApplyAll: () => void;
  fileTargetedCount: number;
  onRunSandbox: (code: string) => Promise<string>;
  onCloseRail?: () => void;
}

export function CodeRailBody({
  checklist,
  checked,
  onChecklistChange,
  onStepPrompt,
  messageBlocks,
  codebases,
  onCodebasesUpdate,
  onApplyAll,
  fileTargetedCount,
  onRunSandbox,
  onCloseRail,
}: CodeRailBodyProps) {
  const totalBlockCount = messageBlocks.reduce((s, g) => s + g.blocks.length, 0);

  return (
    <>
      {checklist.length > 0 && (
        <div className="border-b border-border px-4 sm:px-6 py-4">
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted mb-2">
            Plan checklist
          </p>
          <ul className="space-y-1">
            {checklist.map((step, i) => (
              <li key={i} className="flex items-start gap-2 text-[13px]">
                <input
                  type="checkbox"
                  checked={!!checked[i]}
                  onChange={(e) => onChecklistChange(i, e.target.checked)}
                  className="mt-1"
                />
                <button
                  onClick={() => onStepPrompt(i, step)}
                  className="flex-1 text-left hover:underline underline-offset-2"
                >
                  <span className="font-sans text-muted mr-1">{i + 1}.</span>
                  {step}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <header className="border-b border-border px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted">Code output</p>
          <h3 className="font-display text-lg font-semibold tracking-tightest truncate">
            {totalBlockCount > 0
              ? `${totalBlockCount} block${totalBlockCount === 1 ? '' : 's'} across ${messageBlocks.length} turn${messageBlocks.length === 1 ? '' : 's'}`
              : 'No code yet'}
          </h3>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {fileTargetedCount >= 2 && (
            <button
              onClick={onApplyAll}
              className="text-[11px] uppercase tracking-[0.14em] font-sans border border-fg px-3 py-1 rounded hover:bg-fg hover:text-bg transition-colors"
            >
              Apply all ({fileTargetedCount})
            </button>
          )}
          {onCloseRail && (
            <button
              type="button"
              onClick={onCloseRail}
              className="xl:hidden text-[11px] uppercase tracking-[0.14em] font-sans px-2 py-1 rounded border border-border text-muted hover:border-fg hover:text-fg"
              aria-label="Close output"
            >
              ×
            </button>
          )}
        </div>
      </header>
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-3 min-h-0">
        {messageBlocks.length === 0 ? (
          <p className="text-muted text-sm font-sans">
            Code blocks from assistant messages will appear here.
          </p>
        ) : (
          messageBlocks.slice().reverse().map((group) => (
            <details key={group.messageId} open={group.isLatest} className="group/rail">
              <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden flex items-center gap-2 py-1.5 select-none">
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="transition-transform group-open/rail:rotate-90 shrink-0 text-muted"
                >
                  <polyline points="9 6 15 12 9 18" />
                </svg>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] uppercase tracking-[0.14em] font-sans px-1.5 py-0.5 rounded border border-border text-muted">
                      {group.mode}
                    </span>
                    <span className="text-[11px] font-sans text-fg">
                      {group.blocks.length} block{group.blocks.length === 1 ? '' : 's'}
                    </span>
                    {group.isLatest && (
                      <span className="text-[9px] uppercase tracking-[0.14em] font-sans text-muted bg-panelHi px-1.5 py-0.5 rounded">
                        latest
                      </span>
                    )}
                  </div>
                  {group.userPrompt && (
                    <p className="text-[10px] text-muted font-sans truncate mt-0.5">
                      {group.userPrompt}{group.userPrompt.length >= 80 ? '...' : ''}
                    </p>
                  )}
                </div>
              </summary>
              <div className="pl-4 space-y-3 mt-2 mb-3">
                {group.blocks.map((b) => (
                  <CodeBlockCard
                    key={`${group.messageId}-${b.index}`}
                    block={b}
                    workspace={[]}
                    onRun={onRunSandbox}
                  />
                ))}
              </div>
            </details>
          ))
        )}
      </div>
      <CodebaseManager codebases={codebases} onUpdate={onCodebasesUpdate} />
    </>
  );
}

