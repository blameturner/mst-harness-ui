import { IconButton } from '../../../components/IconButton';

interface CodeHeaderProps {
  approvedPlan: string | null;
  onClearPlan: () => void;
  onToggleSidebar: () => void;
  onToggleOutput: () => void;
  onToggleProperties: () => void;
  propertiesOpen: boolean;
  lastBlocksCount: number;
}

export function CodeHeader({
  approvedPlan,
  onClearPlan,
  onToggleSidebar,
  onToggleOutput,
  onToggleProperties,
  propertiesOpen,
  lastBlocksCount,
}: CodeHeaderProps) {
  return (
    <>
      <header className="border-b border-border px-3 sm:px-6 py-3 sm:py-4 flex items-center gap-3">
        <div className="md:hidden">
          <IconButton
            onClick={onToggleSidebar}
            label="Open sessions"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="4" y1="7" x2="20" y2="7" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="17" x2="20" y2="17" />
            </svg>
          </IconButton>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted">Code worker</p>
          <h2 className="font-display text-base sm:text-xl font-semibold tracking-tightest truncate">
            Plan / Execute / Explain / Review
          </h2>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="xl:hidden">
            <button
              type="button"
              onClick={onToggleOutput}
              className="text-[11px] uppercase tracking-[0.14em] font-sans px-2 sm:px-3 py-1.5 rounded-md border border-border text-fg hover:bg-panelHi transition-colors"
              title="Show code output"
            >
              <span className="hidden sm:inline">Output</span>
              <span className="sm:hidden">
                {lastBlocksCount > 0 ? `Output · ${lastBlocksCount}` : 'Output'}
              </span>
            </button>
          </div>
          <IconButton
            onClick={onToggleProperties}
            label={propertiesOpen ? 'Hide properties' : 'Show properties'}
            active={propertiesOpen}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <line x1="12" y1="8" x2="12" y2="8.01" />
              <line x1="11" y1="12" x2="12" y2="12" />
              <line x1="12" y1="12" x2="12" y2="16" />
              <line x1="11" y1="16" x2="13" y2="16" />
            </svg>
          </IconButton>
        </div>
      </header>

      {approvedPlan && (
        <details className="border-b border-border bg-panel/40 group">
          <summary className="px-3 sm:px-6 py-2 flex items-center justify-between gap-3 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
            <span className="text-[11px] font-sans text-muted min-w-0 truncate flex items-center gap-2">
              <span className="uppercase tracking-[0.14em] text-fg shrink-0">Plan ✓</span>
              <span className="truncate">
                {approvedPlan.split('\n').find((l) => l.trim()) ?? 'approved plan active'}
              </span>
            </span>
            <span className="flex items-center gap-3 shrink-0">
              <span className="text-muted text-[10px] transition-transform group-open:rotate-90">▸</span>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onClearPlan();
                }}
                className="text-[10px] uppercase tracking-[0.14em] text-fg hover:underline underline-offset-4"
              >
                Clear
              </button>
            </span>
          </summary>
          <div className="px-3 sm:px-6 pb-3 pt-1">
            <pre className="text-[11.5px] font-sans text-fg whitespace-pre-wrap max-h-60 overflow-auto border border-border rounded bg-bg p-3">
              {approvedPlan}
            </pre>
            <p className="text-[10px] uppercase tracking-[0.14em] font-sans text-muted mt-2">
              Injected on every execute turn
            </p>
          </div>
        </details>
      )}
    </>
  );
}

